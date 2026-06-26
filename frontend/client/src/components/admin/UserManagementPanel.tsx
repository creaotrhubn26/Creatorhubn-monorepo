/**
 * CreatorHub Norge - User Management Panel
 * Complete RBAC/ABAC user administration for admin dashboard
 */

import React, { useMemo, useState } from 'react';
import { apiRequest, isApiEndpointMissing, queryClient } from '@/lib/queryClient';
import { useQuery, useMutation } from '@tanstack/react-query';
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
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Alert,
  Skeleton,
  Tooltip,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  Snackbar,
  Avatar,
  Checkbox,
  InputAdornment,
  Pagination,
  ThemeProvider,
} from '@mui/material';
import { adminDarkTheme } from './adminDarkTheme';
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
  Business as BusinessIcon,
} from '@mui/icons-material';
import { useToast } from '@/hooks/use-toast';
import AdminInviteSystem from '../../pages/admin-invite-system.tsx';
import { EmailDesigner } from '../EmailDesigner/EmailDesigner';
import { ADMIN_EMAIL_DESIGNER_PRESETS } from './emailDesignerPresets';
import { getAllProfessionFeatures } from '../../../../shared/profession-feature-matrix';
import { UserFolderAccessViewer } from './UserFolderAccessViewer';
import UserInstallationsPanel from './UserInstallationsPanel';
import AcademyAdminPanel from './AcademyAdminPanel';
import EnterpriseInquiriesPanel from './EnterpriseInquiriesPanel';
import { useAdminPresence, OnlineStatusDot } from './shared/useAdminPresence';
import {
  AdminButton,
  StatusChip,
  AdminTableContainer,
  adminTokens,
} from './design-system';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  createdAt?: string | null;
  updatedAt?: string;
  profession?: string;
  businessName?: string;
  companyName?: string;
  organizationNumber?: string;
  isActive: boolean;
  role?: string;
  roleLabel?: string;
  accessScope?: string | null;
  accessScopeLabel?: string | null;
  accessDescription?: string | null;
  isPlatformAdmin?: boolean;
  isAcademyAdmin?: boolean;
  status?: string;
  accountUserId?: string | null;
  inviteRequestId?: string | null;
  canImpersonate?: boolean;
  permissions?: string[];
  paymentCompleted?: boolean;
  planName?: string | null;
  planPrice?: number | null;
  paymentAmount?: number | null;
  paymentTimestamp?: string | null;
  onboardingStatus?: string | null;
  source?: string | null;
  selectedPlan?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  approvedByUserId?: string | null;
  lastLoginAt?: string | null;
  roleRoomAccess?: {
    persona?: string | null;
    personaLabel?: string | null;
    subscriptionType?: string | null;
    subscriptionLabel?: string | null;
    companyName?: string | null;
    organizationNumber?: string | null;
    teamLeadName?: string | null;
    teamLeadEmail?: string | null;
    teamSize?: number | null;
    seatPriceExVat?: number | null;
    monthlyTotalExVat?: number | null;
    taxMode?: string | null;
    isTeamLeader?: boolean;
    memberRoleId?: string | null;
    memberRoleLabel?: string | null;
  } | null;
}

interface Role {
  id: string;
  name: string;
  permissions: string[];
  description: string;
}

interface AccountingIntegrationStatus {
  configured?: boolean;
  activationEnabled?: boolean;
  activatedAt?: string | null;
  activatedByName?: string | null;
  activationNotes?: string | null;
  provider?: 'fiken' | 'tripletex';
  environment?: 'test' | 'production';
  status?: 'connected' | 'disconnected' | 'error';
  connectedAt?: string | null;
  lastVerifiedAt?: string | null;
  lastError?: string | null;
  organizationNumber?: string | null;
  businessName?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  addressLine1?: string | null;
  postalCode?: string | null;
  city?: string | null;
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

export default function UserManagementPanel(_: UserManagementPanelProps) {
  const presence = useAdminPresence();
  const [tabValue, setTabValue] = useState(0);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [usersPage, setUsersPage] = useState(1);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editProfessionOpen, setEditProfessionOpen] = useState(false);
  const [editProfessionValue, setEditProfessionValue] = useState<string>('');
  const [editRoleOpen, setEditRoleOpen] = useState(false);
  const [editRoleValue, setEditRoleValue] = useState<string>('user');
  const [accountingDialogOpen, setAccountingDialogOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageSending, setMessageSending] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [messageSentTo, setMessageSentTo] = useState<string | null>(null);
  const [accountingForm, setAccountingForm] = useState({
    businessName: '',
    organizationNumber: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    addressLine1: '',
    postalCode: '',
    city: '',
    activationNotes: '',
  });
  const [folderViewUserId, setFolderViewUserId] = useState<string | null>(null);
  const [errorSnackbar, setErrorSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: '' });

  const { toast } = useToast();

  // Master Integration Provider
  const { communication, dataFlow, componentRegistry } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('prototype_tester');

  // Feature access system
  const { totalActiveIntegrations } = useIntegrationFeatures();
  const professionIds = useMemo(
    () => Object.keys(theming.professionConfig),
    [theming.professionConfig],
  );

  const getDefaultProfessionForRole = (roleId?: string | null) => {
    const normalizedRole = String(roleId || '').trim().toLowerCase();
    const preferredProfessionIds =
      normalizedRole === 'vendor'
        ? ['vendor']
        : normalizedRole === 'enterprise_admin'
          ? ['enterprise']
          : normalizedRole === 'academy_admin'
            ? ['instructor']
          : normalizedRole === 'instructor'
            ? ['instructor']
            : normalizedRole === 'admin' || normalizedRole === 'super_admin'
              ? ['admin', 'photographer']
              : ['photographer', 'admin'];

    return (
      preferredProfessionIds.find((professionId) => professionIds.includes(professionId)) ||
      professionIds[0] ||
      'photographer'
    );
  };
  
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

  const formatUserName = (currentUser: User) => {
    const fullName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim();
    return fullName || currentUser.email.split('@')[0];
  };

  const formatUserDate = (value?: string | null) => {
    if (!value) return 'Ukjent';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Ukjent';
    return parsed.toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatOrganizationNumber = (value?: string | null) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length !== 9) {
      return value || 'Ikke oppgitt';
    }
    return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
  };

  const formatCurrencyNok = (value?: number | null) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return null;
    }
    return `${value.toLocaleString('nb-NO')} kr`;
  };

  const getSourceChip = (source?: string | null) => {
    const normalized = String(source || '').trim().toLowerCase();
    if (normalized === 'role_room') {
      return {
        label: 'The Role Room',
        sx: {
          bgcolor: 'rgba(255,255,255,0.08)',
          color: '#fbbf24',
        },
      };
    }
    if (normalized === 'creatorhub') {
      return {
        label: 'CreatorHub',
        sx: {
          bgcolor: 'rgba(255,255,255,0.08)',
          color: '#93c5fd',
        },
      };
    }
    return null;
  };

  const getEffectiveSource = (currentUser: User) => {
    if (currentUser.source) {
      return currentUser.source;
    }
    if (currentUser.roleRoomAccess) {
      return 'role_room';
    }
    return null;
  };

  const getAccessScopePresentation = (currentUser: User) => {
    const normalizedScope = String(currentUser.accessScope || '').trim().toLowerCase();

    if (normalizedScope === 'platform_admin' || currentUser.isPlatformAdmin) {
      return {
        label: currentUser.accessScopeLabel || 'Plattform-admin',
        description:
          currentUser.accessDescription ||
          'Full kontroll over CreatorHub, brukere, roller, billing og Academy.',
        sx: {
          bgcolor: 'rgba(255,255,255,0.08)',
          color: '#86efac',
        },
      };
    }

    if (normalizedScope === 'academy_admin' || currentUser.isAcademyAdmin) {
      return {
        label: currentUser.accessScopeLabel || 'Academy-admin',
        description:
          currentUser.accessDescription ||
          'Kan administrere Academy-innhold og Academy-tilganger, men ikke plattformadmin.',
        sx: {
          bgcolor: 'rgba(255,255,255,0.08)',
          color: '#93c5fd',
        },
      };
    }

    if (normalizedScope === 'academy_editor') {
      return {
        label: currentUser.accessScopeLabel || 'Academy-redaktør',
        description:
          currentUser.accessDescription ||
          'Kan vedlikeholde Academy-innhold, uten admin-tilgang.',
        sx: {
          bgcolor: 'rgba(255,255,255,0.08)',
          color: '#c084fc',
        },
      };
    }

    return {
      label: currentUser.accessScopeLabel || 'Standardtilgang',
      description:
        currentUser.accessDescription ||
        'Rolle- og produktstyrt tilgang uten admin-rettigheter.',
      sx: {
        bgcolor: 'rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.6)',
      },
    };
  };

  const getAccessPills = (currentUser: User) => {
    const pills: Array<{ key: string; label: string; sx: Record<string, unknown> }> = [];
    const accessScope = getAccessScopePresentation(currentUser);
    const roleLabel =
      currentUser.roleLabel ||
      roleById.get(currentUser.role || '')?.name ||
      currentUser.role ||
      'Bruker';

    pills.push({
      key: 'access-scope',
      label: accessScope.label,
      sx: accessScope.sx,
    });

    const normalizedScopeLabel = accessScope.label.trim().toLowerCase();
    const normalizedRoleLabel = roleLabel.trim().toLowerCase();
    if (
      normalizedRoleLabel &&
      normalizedRoleLabel !== normalizedScopeLabel &&
      normalizedRoleLabel !== 'bruker'
    ) {
      pills.push({
        key: 'role',
        label: roleLabel,
        sx: {
          bgcolor: 'rgba(255,255,255,0.08)',
          color: '#93c5fd',
        },
      });
    }

    if (!currentUser.isActive) {
      pills.push({
        key: 'inactive',
        label: 'Inaktiv',
        sx: {
          bgcolor: 'rgba(255,255,255,0.08)',
          color: '#fca5a5',
        },
      });
    } else if (String(currentUser.status || '').toLowerCase() === 'pending') {
      pills.push({
        key: 'status',
        label: 'Avventer',
        sx: {
          bgcolor: 'rgba(255,255,255,0.08)',
          color: '#fbbf24',
        },
      });
    }

    return pills;
  };

  const getRoleRoomActivationChip = (currentUser: User) => {
    const normalized = String(currentUser.onboardingStatus || '').trim().toLowerCase();
    if (normalized === 'role_room_activation_required') {
      return {
        label: 'Venter kontogodkjenning',
        sx: {
          bgcolor: 'rgba(255,255,255,0.08)',
          color: '#fdba74',
        },
      };
    }
    if (normalized === 'role_room_access_activated' || normalized === 'active') {
      return {
        label: 'Konto godkjent',
        sx: {
          bgcolor: 'rgba(255,255,255,0.08)',
          color: '#60a5fa',
        },
      };
    }
    return null;
  };

  // Fetch users
  const {
    data: usersData = [],
    isLoading: usersLoading,
    error: usersError,
  } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const response = await apiRequest('/api/admin/users');
      if (Array.isArray(response)) return response as User[];
      if (response && typeof response === 'object' && Array.isArray((response as { users?: User[] }).users)) {
        return (response as { users: User[] }).users;
      }
      return [];
    },
    staleTime: 30000
  });

  // Fetch roles
  const {
    data: rolesData = [],
    error: rolesError,
  } = useQuery<Role[]>({
    queryKey: ['/api/admin/roles'],
    queryFn: async () => {
      const response = await apiRequest('/api/admin/roles');
      if (Array.isArray(response)) return response as Role[];
      if (response && typeof response === 'object' && Array.isArray((response as { roles?: Role[] }).roles)) {
        return (response as { roles: Role[] }).roles;
      }
      return [];
    },
    staleTime: 300000 // 5 minutes
  });

  const users = useMemo(() => usersData, [usersData]);
  const roles = useMemo(() => rolesData, [rolesData]);
  const roleById = useMemo(
    () => new Map(roles.map((role) => [role.id, role])),
    [roles],
  );

  const accessOverview = useMemo(() => {
    return users.reduce(
      (summary, currentUser) => {
        const normalizedScope = String(currentUser.accessScope || '').trim().toLowerCase();
        if (normalizedScope === 'platform_admin' || currentUser.isPlatformAdmin) {
          summary.platformAdmins += 1;
        } else if (normalizedScope === 'academy_admin' || currentUser.isAcademyAdmin) {
          summary.academyAdmins += 1;
        } else if (normalizedScope === 'academy_editor') {
          summary.academyEditors += 1;
        } else {
          summary.standardUsers += 1;
        }
        return summary;
      },
      {
        platformAdmins: 0,
        academyAdmins: 0,
        academyEditors: 0,
        standardUsers: 0,
      },
    );
  }, [users]);

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: {
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      profession?: string;
      businessName?: string;
      sendInvite: boolean;
    }) => {
      return apiRequest('/api/admin/users', {
        method: 'POST',
        body: userData,
      });
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
        description: "Ny bruker er opprettet i admin-datagrunnlaget.",
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
      return apiRequest(`/api/admin/users/${userId}/payment-status`);
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
      return apiRequest(`/api/admin/users/${userId}/activate-google-wallet`, {
        method: 'POST',
        body: { planId },
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Google Wallet aktivert",
        description: data?.skipped
          ? "Google Wallet-flyten er registrert, men ikke koblet til ennå."
          : "Medlemskort er opprettet og sendt til bruker",
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
      const paymentStatus = (await verifyPaymentMutation.mutateAsync(userId)) as {
        hasPayment?: boolean;
        paymentCompleted?: boolean;
        planId?: string | null;
      };

      if (paymentStatus.hasPayment && !paymentStatus.paymentCompleted) {
        throw new Error('Bruker har ikke fullført betaling');
      }

      // Activate Google Wallet if payment is complete
      if (paymentStatus.planId) {
        await activateGoogleWalletMutation.mutateAsync({ userId, planId: paymentStatus.planId });
      }

      // Approve user
      const response = await apiRequest(`/api/admin/users/${userId}/approve`, {
        method: 'POST'
      });

      // Auto-onboard to CreatorHub Norge Community (NEW)
      if (user.profession && user.profession !== 'vendor') {
        try {
          const communityResponse = await apiRequest('/api/community/onboard-user', {
            method: 'POST',
            body: {
              userId: user.id,
              profession: user.profession,
              email: user.email,
            },
          });
          console.log('✅ User auto-onboarded to community: ', communityResponse);
        } catch (communityError) {
          if (isApiEndpointMissing(communityError)) {
            console.debug('Community onboarding endpoint is not available in this environment.');
          } else {
            console.error('⚠️ Failed to onboard user to community: ', communityError);
          }
          // Don't fail the entire approval if community onboarding fails
        }
      }

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "Bruker godkjent",
        description: "Bruker er godkjent og har fått tilgang til plattformen.",
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

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: Record<string, unknown> }) => {
      return apiRequest(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: updates,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: 'Bruker oppdatert',
        description: 'Brukeren er oppdatert.',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      setErrorSnackbar({ open: true, message: error.message || 'Kunne ikke oppdatere bruker' });
    },
  });

  const updateProfessionMutation = useMutation({
    mutationFn: async ({ userId, profession }: { userId: string; profession: string }) => {
      return apiRequest(`/api/admin/users/${userId}/profession`, {
        method: 'PUT',
        body: { profession },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setEditProfessionOpen(false);
      setSelectedUser(null);
      toast({
        title: 'Profesjon oppdatert',
        description: 'Profesjonen er lagret.',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      setErrorSnackbar({ open: true, message: error.message || 'Kunne ikke oppdatere profesjon' });
    },
  });

  const accountingStatusQuery = useQuery<AccountingIntegrationStatus>({
    queryKey: ['/api/admin/users/accounting-integration', selectedUser?.id],
    queryFn: async () => {
      if (!selectedUser?.id) {
        return {};
      }
      return apiRequest(`/api/admin/users/${selectedUser.id}/accounting-integration`);
    },
    enabled: accountingDialogOpen && Boolean(selectedUser?.id),
    retry: false,
  });

  React.useEffect(() => {
    if (!selectedUser || !accountingDialogOpen) {
      return;
    }

    const accountingStatus = accountingStatusQuery.data;
    setAccountingForm({
      businessName:
        accountingStatus?.businessName ||
        selectedUser.businessName ||
        selectedUser.companyName ||
        '',
      organizationNumber:
        accountingStatus?.organizationNumber ||
        selectedUser.organizationNumber ||
        '',
      contactName:
        accountingStatus?.contactName ||
        formatUserName(selectedUser),
      contactEmail:
        accountingStatus?.contactEmail ||
        selectedUser.email ||
        '',
      contactPhone:
        accountingStatus?.contactPhone || '',
      addressLine1:
        accountingStatus?.addressLine1 || '',
      postalCode:
        accountingStatus?.postalCode || '',
      city:
        accountingStatus?.city || '',
      activationNotes:
        accountingStatus?.activationNotes || '',
    });
  }, [accountingDialogOpen, accountingStatusQuery.data, selectedUser]);

  const updateAccountingActivationMutation = useMutation({
    mutationFn: async ({
      userId,
      activationEnabled,
    }: {
      userId: string;
      activationEnabled: boolean;
    }) => {
      return apiRequest(`/api/admin/users/${userId}/accounting-integration`, {
        method: 'PUT',
        body: {
          activationEnabled,
          ...accountingForm,
        },
      });
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/users/accounting-integration'] });
      toast({
        title: variables.activationEnabled ? 'Regnskapsflyt aktivert' : 'Regnskapsflyt deaktivert',
        description: variables.activationEnabled
          ? 'Brukeren er klargjort for Tripletex-oppsett.'
          : 'Regnskapsflyten er slått av for brukeren.',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      setErrorSnackbar({ open: true, message: error.message || 'Kunne ikke oppdatere regnskapsflyten' });
    },
  });

  const connectAccountingTestMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest('/api/accounting/integration/tripletex/test/connect', {
        method: 'POST',
        body: {
          userId,
          ...accountingForm,
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/users/accounting-integration'] });
      toast({
        title: 'Tripletex test koblet til',
        description: 'Testmiljøet er nå koblet til for valgt bruker.',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      setErrorSnackbar({ open: true, message: error.message || 'Kunne ikke koble til Tripletex testmiljø' });
    },
  });

  // Start impersonation mutation
  const impersonateMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest('/api/admin/impersonate/start', {
        method: 'POST',
        body: { targetUserId: userId },
      });
    },
    onSuccess: (data) => {
      // Broadcast impersonation event
      communication.sendBroadcast('admin:user:impersonated', {
        type: 'user_impersonated',
        data,
        component: 'UserManagementPanel'
      });

      const nextToken = typeof data?.token === 'string' ? data.token : '';
      const nextUser = data?.targetUser && typeof data.targetUser === 'object'
        ? data.targetUser
        : null;
      if (nextToken && nextUser) {
        try {
          const previousToken = localStorage.getItem('creatorhub_auth_token');
          const previousUser = localStorage.getItem('creatorhub_auth_user');
          if (previousToken && previousUser) {
            localStorage.setItem(
              'creatorhub_impersonation_admin_session',
              JSON.stringify({ token: previousToken, user: previousUser }),
            );
          }
          localStorage.setItem('creatorhub_auth_token', nextToken);
          localStorage.setItem('creatorhub_auth_user', JSON.stringify(nextUser));
          if (typeof nextUser.id === 'string') {
            localStorage.setItem('userId', nextUser.id);
          }
          if (typeof nextUser.email === 'string') {
            localStorage.setItem('userEmail', nextUser.email);
          }
          window.dispatchEvent(new Event('auth-changed'));
        } catch (storageError) {
          console.error('Failed to persist impersonation session:', storageError);
        }
      }
      
      toast({
        title: "Impersonering startet",
        description: `Du er nå logget inn som ${data.targetUser.email}`,
        variant: "default"
      });

      window.setTimeout(() => {
        window.location.href = '/dashboard';
      }, 120);
    },
    onError: (error: Error) => {
      toast({
        title: "Feil ved impersonering",
        description: error.message || "Kunne ikke starte brukerimpersonering",
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
      userCount: users.length
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
}, [communication, componentRegistry, createUserMutation, dataFlow, impersonateMutation, users.length]);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, user: User) => {
    setAnchorEl(event.currentTarget);
    setSelectedUser(user);
};

  const handleMenuClose = () => {
    setAnchorEl(null);
};

  const handleOpenAccountingDialog = () => {
    setAccountingDialogOpen(true);
    handleMenuClose();
  };

  const handleOpenMessageDialog = () => {
    setMessageError(null);
    setMessageOpen(true);
    handleMenuClose();
  };

  // Sends an admin → user direct message. The backend resolves/creates a
  // deterministic dm-admin-<userId> channel (+ participant row) so it lands in
  // the user's CreatorHub chat widget — see admin-communication-extras-routes.
  const handleSendMessage = async () => {
    if (!selectedUser || !messageText.trim()) return;
    setMessageSending(true);
    setMessageError(null);
    try {
      await apiRequest('/api/admin/communication/send', {
        method: 'POST',
        body: { userId: selectedUser.id, message: messageText.trim() },
      });
      setMessageSentTo(selectedUser.email || selectedUser.id);
      setMessageOpen(false);
      setMessageText('');
    } catch (err) {
      setMessageError(err instanceof Error ? err.message : 'Kunne ikke sende meldingen.');
    } finally {
      setMessageSending(false);
    }
  };

  const handleImpersonate = () => {
    if (selectedUser?.accountUserId) {
      impersonateMutation.mutate(selectedUser.accountUserId);
    }
    handleMenuClose();
};

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const normalizedRole = selectedRole.trim().toLowerCase();

    return users.filter((currentUser) => {
      const fullName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim().toLowerCase();
      const businessName = String(currentUser.businessName || currentUser.companyName || '').toLowerCase();
      const profession = String(currentUser.profession || '').toLowerCase();
      const role = String(currentUser.role || '').toLowerCase();
      const organizationNumber = String(currentUser.organizationNumber || '').toLowerCase();
      const planName = String(currentUser.planName || currentUser.selectedPlan || '').toLowerCase();
      const source = String(getEffectiveSource(currentUser) || '').toLowerCase();
      const accessScopeLabel = String(currentUser.accessScopeLabel || '').toLowerCase();
      const accessDescription = String(currentUser.accessDescription || '').toLowerCase();

      const matchesSearch = !normalizedSearch || [
        currentUser.email.toLowerCase(),
        fullName,
        businessName,
        profession,
        role,
        organizationNumber,
        planName,
        source,
        accessScopeLabel,
        accessDescription,
      ].some((value) => value.includes(normalizedSearch));

      const matchesRole = !normalizedRole || role === normalizedRole;
      return matchesSearch && matchesRole;
    });
  }, [searchTerm, selectedRole, users]);

  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / 8));
  const paginatedUsers = useMemo(() => {
    const startIndex = (usersPage - 1) * 8;
    return filteredUsers.slice(startIndex, startIndex + 8);
  }, [filteredUsers, usersPage]);
  const paidUserCount = useMemo(
    () => users.filter((currentUser) => currentUser.paymentCompleted).length,
    [users],
  );
  const pendingPaymentCount = useMemo(
    () =>
      users.filter(
        (currentUser) =>
          !currentUser.paymentCompleted &&
          Boolean(
            currentUser.planName ||
              currentUser.selectedPlan ||
              currentUser.roleRoomAccess?.subscriptionLabel,
          ),
      ).length,
    [users],
  );
  const academyScopedCount = accessOverview.academyAdmins + accessOverview.academyEditors;
  const teamLeadCount = useMemo(
    () => users.filter((currentUser) => currentUser.roleRoomAccess?.isTeamLeader).length,
    [users],
  );

  React.useEffect(() => {
    setUsersPage((currentPage) => Math.min(currentPage, totalUserPages));
  }, [totalUserPages]);

  const InviteUserDialog = () => {
    const defaultInviteRole = roleById.has('user') ? 'user' : roles[0]?.id || 'user';
    const defaultInviteProfession = getDefaultProfessionForRole(defaultInviteRole);
    const [formData, setFormData] = useState({
      email: '',
      firstName: '',
      lastName: '',
      role: defaultInviteRole,
      profession: defaultInviteProfession,
      businessName: '',
      sendInvite: true
  });

    const handleSubmit = () => {
      if (!formData.email.trim()) {
        toast({
          title: "E-post påkrevd",
          description: "Du må fylle inn e-postadresse",
          variant: "destructive"
      });
        return;
      }
      createUserMutation.mutate({
        ...formData,
        profession: formData.profession || getDefaultProfessionForRole(formData.role),
      });
  };

    return (
      <Dialog open={inviteDialogOpen} onClose={() => setInviteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <PersonAddIcon sx={{ color: adminTokens.color.brand }} />
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
              <InputLabel>Tilgangsrolle</InputLabel>
              <Select
                value={formData.role}
                onChange={(e) =>
                  setFormData((prev) => {
                    const nextRole = e.target.value;
                    const previousDefaultProfession = getDefaultProfessionForRole(prev.role);
                    const nextProfession =
                      !prev.profession || prev.profession === previousDefaultProfession
                        ? getDefaultProfessionForRole(nextRole)
                        : prev.profession;
                    return { ...prev, role: nextRole, profession: nextProfession };
                  })
                }
                label="Tilgangsrolle"
              >
                {roles.map((role: Role) => (
                  <MenuItem key={role.id} value={role.id}>
                    {role.name} - {role.description}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Profesjon</InputLabel>
              <Select
                value={formData.profession}
                onChange={(e) => setFormData(prev => ({ ...prev, profession: e.target.value }))}
                label="Profesjon"
              >
                {professionIds.map((id) => {
                  const branding = theming.getProfessionBranding(id);
                  return (
                    <MenuItem key={id} value={id}>
                      {branding.label}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Bedrift"
              value={formData.businessName}
              onChange={(e) => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
            />
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
          <AdminButton tone="ghost" onClick={() => setInviteDialogOpen(false)}>
            Avbryt
          </AdminButton>
          <AdminButton
            tone="primary"
            onClick={handleSubmit}
            loading={createUserMutation.isPending}
            disabled={createUserMutation.isPending}
          >
            {createUserMutation.isPending ? 'Oppretter...' : 'Opprett bruker'}
          </AdminButton>
        </DialogActions>
      </Dialog>
    );
};

  const UserActionsMenu = () => (
    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
      <MenuItem
        onClick={() => {
          if (selectedUser) {
            setEditRoleValue(selectedUser.role || roles[0]?.id || 'user');
            setEditRoleOpen(true);
          }
          handleMenuClose();
        }}
      >
        <SecurityIcon sx={{ mr: 1, fontSize: 18 }} />
        Endre rolle
      </MenuItem>
      <MenuItem
        onClick={() => {
          if (selectedUser) {
            setEditProfessionValue(
              selectedUser.profession || getDefaultProfessionForRole(selectedUser.role),
            );
            setEditProfessionOpen(true);
          }
          handleMenuClose();
        }}
      >
        <PeopleIcon sx={{ mr: 1, fontSize: 18 }} />
        Endre profesjon
      </MenuItem>
      <MenuItem onClick={handleOpenAccountingDialog}>
        <BusinessIcon sx={{ mr: 1, fontSize: 18 }} />
        Regnskapsflyt
      </MenuItem>
      <MenuItem onClick={handleImpersonate} disabled={!selectedUser?.canImpersonate}>
        <SecurityIcon sx={{ mr: 1, fontSize: 18 }} />
        Impersoner bruker
      </MenuItem>
      <MenuItem onClick={handleOpenMessageDialog} disabled={!selectedUser}>
        <EmailIcon sx={{ mr: 1, fontSize: 18 }} />
        Send melding
      </MenuItem>
      {selectedUser?.status === 'pending' ? (
        <MenuItem
          onClick={() => {
            if (selectedUser) {
              approveUserMutation.mutate({ userId: selectedUser.id, user: selectedUser });
            }
            handleMenuClose();
          }}
        >
          <CheckCircleIcon sx={{ mr: 1, fontSize: 18 }} />
          Godkjenn bruker
        </MenuItem>
      ) : null}
      <MenuItem
        onClick={() => {
          if (selectedUser) {
            updateUserMutation.mutate({
              userId: selectedUser.id,
              updates: { isActive: !selectedUser.isActive },
            });
          }
          handleMenuClose();
        }}
      >
        <BlockIcon sx={{ mr: 1, fontSize: 18 }} />
        {selectedUser?.isActive ? 'Deaktiver bruker' : 'Aktiver bruker'}
      </MenuItem>
    </Menu>
  );

  const EditRoleDialog = () => (
    <Dialog open={editRoleOpen} onClose={() => { setEditRoleOpen(false); setSelectedUser(null); }} maxWidth="xs" fullWidth>
      <DialogTitle>Endre rolle</DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ mt: 1 }}>
          <InputLabel>Rolle</InputLabel>
          <Select
            label="Rolle"
            value={editRoleValue}
            onChange={(e) => setEditRoleValue(String(e.target.value))}
          >
            {roles.map((role) => (
              <MenuItem key={role.id} value={role.id}>
                {role.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {roleById.get(editRoleValue)?.description ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            {roleById.get(editRoleValue)?.description}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <AdminButton tone="ghost" onClick={() => { setEditRoleOpen(false); setSelectedUser(null); }}>Avbryt</AdminButton>
        <AdminButton
          tone="primary"
          loading={updateUserMutation.isPending}
          disabled={!selectedUser || updateUserMutation.isPending}
          onClick={() => {
            if (!selectedUser) return;
            updateUserMutation.mutate(
              { userId: selectedUser.id, updates: { role: editRoleValue } },
              {
                onSuccess: () => {
                  setEditRoleOpen(false);
                  setSelectedUser(null);
                },
              },
            );
          }}
        >
          Lagre rolle
        </AdminButton>
      </DialogActions>
    </Dialog>
  );

  const EditProfessionDialog = () => (
    <Dialog
      open={editProfessionOpen}
      onClose={() => {
        setEditProfessionOpen(false);
        setSelectedUser(null);
      }}
      maxWidth="xs"
      fullWidth
    >
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
            {professionIds.map((id) => {
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
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <AdminButton tone="ghost" onClick={() => { setEditProfessionOpen(false); setSelectedUser(null); }}>Avbryt</AdminButton>
        <AdminButton
          tone="primary"
          loading={updateProfessionMutation.isPending}
          disabled={!selectedUser || updateProfessionMutation.isPending}
          onClick={() => {
            if (!selectedUser) return;
            updateProfessionMutation.mutate({
              userId: selectedUser.id,
              profession:
                editProfessionValue || getDefaultProfessionForRole(selectedUser.role),
            });
          }}
        >
          Lagre
        </AdminButton>
      </DialogActions>
    </Dialog>
  );

  const AccountingActivationDialog = () => {
    const accountingStatus = accountingStatusQuery.data || null;
    const activationActive = Boolean(accountingStatus?.activationEnabled);
    const isConnected = accountingStatus?.status === 'connected';
    const actionPending =
      updateAccountingActivationMutation.isPending || connectAccountingTestMutation.isPending;

    return (
      <Dialog
        open={accountingDialogOpen}
        onClose={() => {
          setAccountingDialogOpen(false);
          setSelectedUser(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Administrer regnskapsflyt</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {selectedUser ? (
              <Alert severity="info">
                Du aktiverer denne løsningen for <strong>{formatUserName(selectedUser)}</strong>. Selve oppsettet er skjult
                for vanlige brukere og styres kun fra admin.
              </Alert>
            ) : null}

            {accountingStatusQuery.error instanceof Error ? (
              <Alert severity="error">{accountingStatusQuery.error.message}</Alert>
            ) : null}

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <StatusChip
                tone={activationActive ? 'success' : 'neutral'}
                label={activationActive ? 'Aktivert for bruker' : 'Ikke aktivert'}
              />
              <StatusChip
                tone={isConnected ? 'success' : 'neutral'}
                label={isConnected ? 'Tripletex test tilkoblet' : 'Tripletex ikke koblet'}
              />
            </Box>

            {!accountingStatus?.configured ? (
              <Alert severity="warning">
                Tripletex testmiljø er ikke konfigurert i backend ennå. Du kan fortsatt aktivere løsningen for brukeren,
                men selve testkoblingen blir først mulig når backend-nøklene er lagt inn.
              </Alert>
            ) : null}

            <TextField
              label="Firmanavn"
              value={accountingForm.businessName}
              onChange={(event) => setAccountingForm((prev) => ({ ...prev, businessName: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Organisasjonsnummer"
              value={accountingForm.organizationNumber}
              onChange={(event) => setAccountingForm((prev) => ({ ...prev, organizationNumber: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Kontaktperson"
              value={accountingForm.contactName}
              onChange={(event) => setAccountingForm((prev) => ({ ...prev, contactName: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Kontakt-e-post"
              value={accountingForm.contactEmail}
              onChange={(event) => setAccountingForm((prev) => ({ ...prev, contactEmail: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Telefon"
              value={accountingForm.contactPhone}
              onChange={(event) => setAccountingForm((prev) => ({ ...prev, contactPhone: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Adresse"
              value={accountingForm.addressLine1}
              onChange={(event) => setAccountingForm((prev) => ({ ...prev, addressLine1: event.target.value }))}
              fullWidth
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Postnummer"
                value={accountingForm.postalCode}
                onChange={(event) => setAccountingForm((prev) => ({ ...prev, postalCode: event.target.value }))}
                fullWidth
              />
              <TextField
                label="Poststed"
                value={accountingForm.city}
                onChange={(event) => setAccountingForm((prev) => ({ ...prev, city: event.target.value }))}
                fullWidth
              />
            </Box>
            <TextField
              label="Admin-notat"
              value={accountingForm.activationNotes}
              onChange={(event) => setAccountingForm((prev) => ({ ...prev, activationNotes: event.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />

            {activationActive && accountingStatus?.activatedAt ? (
              <Typography variant="caption" color="text.secondary">
                Aktivert {formatUserDate(accountingStatus.activatedAt)} av {accountingStatus.activatedByName || 'admin'}.
              </Typography>
            ) : null}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <AdminButton
            tone="ghost"
            onClick={() => {
              setAccountingDialogOpen(false);
              setSelectedUser(null);
            }}
          >
            Lukk
          </AdminButton>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {activationActive ? (
              <AdminButton
                tone="danger"
                disabled={!selectedUser || actionPending}
                onClick={() => {
                  if (!selectedUser) return;
                  updateAccountingActivationMutation.mutate({
                    userId: selectedUser.id,
                    activationEnabled: false,
                  });
                }}
              >
                Deaktiver løsning
              </AdminButton>
            ) : (
              <AdminButton
                tone="secondary"
                disabled={!selectedUser || actionPending}
                onClick={() => {
                  if (!selectedUser) return;
                  updateAccountingActivationMutation.mutate({
                    userId: selectedUser.id,
                    activationEnabled: true,
                  });
                }}
              >
                Aktiver løsning
              </AdminButton>
            )}
            <AdminButton
              tone="primary"
              disabled={!selectedUser || actionPending || !activationActive || !accountingStatus?.configured}
              onClick={() => {
                if (!selectedUser) return;
                connectAccountingTestMutation.mutate(selectedUser.id);
              }}
            >
              Aktiver Tripletex test
            </AdminButton>
          </Box>
        </DialogActions>
      </Dialog>
    );
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const panelSurfaceSx = {
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '24px',
    bgcolor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
    boxShadow: '0 14px 40px rgba(29, 22, 12, 0.04)',
  } as const;

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Box sx={{ px: { xs: 1, sm: 0 }, pb: { xs: 2, sm: 0 } }}>
      <InviteUserDialog />
      <UserActionsMenu />
      <EditRoleDialog />
      <EditProfessionDialog />
      <AccountingActivationDialog />

      {/* Send melding til bruker — inlined (ikke render-helper) så TextField
          beholder fokus mellom tastetrykk. */}
      <Dialog open={messageOpen} onClose={() => setMessageOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Send melding{selectedUser ? ` til ${selectedUser.email || selectedUser.id}` : ''}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Meldingen havner i brukerens CreatorHub-chat (Direktemelding fra admin).
          </Typography>
          {messageError ? (
            <Typography variant="body2" sx={{ color: 'error.main', mb: 1 }}>{messageError}</Typography>
          ) : null}
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label="Melding"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            disabled={messageSending}
          />
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setMessageOpen(false)} disabled={messageSending}>Avbryt</AdminButton>
          <AdminButton
            tone="primary"
            onClick={handleSendMessage}
            loading={messageSending}
            disabled={messageSending || !messageText.trim() || !selectedUser}
          >
            {messageSending ? 'Sender…' : 'Send'}
          </AdminButton>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={Boolean(messageSentTo)}
        autoHideDuration={4000}
        onClose={() => setMessageSentTo(null)}
        message={messageSentTo ? `Melding sendt til ${messageSentTo}` : ''}
      />

      {/* Header */}
      <Box
        sx={{
          mb: 3.5,
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.12)',
          background:
            'linear-gradient(135deg, rgba(15,23,42,0.94), rgba(255,255,255,0.04))',
          px: { xs: 2, sm: 3 },
          py: { xs: 2.25, sm: 2.75 },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', xl: 'row' },
            alignItems: { xs: 'flex-start', xl: 'stretch' },
            justifyContent: 'space-between',
            gap: 2.5,
          }}
        >
          <Box sx={{ maxWidth: 760, flex: 1 }}>
            <Typography variant="overline" sx={{ color: adminTokens.color.brand, fontWeight: 700, letterSpacing: '0.08em' }}>
              CreatorHub Access Control
            </Typography>
            <Typography
              variant="h4"
              sx={{
                mt: 0.5,
                fontSize: { xs: '1.7rem', sm: '2rem' },
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: '#ffffff',
              }}
            >
              Brukere & Roller
            </Typography>
            <Typography
              variant="body2"
              sx={{
                mt: 1,
                maxWidth: 640,
                color: 'rgba(255,255,255,0.6)',
                lineHeight: 1.7,
              }}
            >
              Administrer medlemmer, godkjenninger og tilgangsnivåer i én ryddig arbeidsflate.
              Daniel skal kunne lese hvem som har kontroll, hvem som venter, og hvilke kontoer som trenger oppfølging uten å lete i tabellen først.
            </Typography>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mt: 1.75,
                color: 'rgba(255,255,255,0.6)',
                flexWrap: 'wrap',
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 600, letterSpacing: '0.08em' }}>
                AKTIVE INTEGRASJONER
              </Typography>
              <Chip
                label={`${totalActiveIntegrations}/12 aktive`}
                size="small"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.08)',
                  color: '#ffffff',
                  borderRadius: '999px',
                  border: '1px solid #ebe4da',
                  fontWeight: 600,
                }}
              />
              <Chip
                label={`${filteredUsers.length} i nåværende søk`}
                size="small"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.06)',
                  color: '#ffffff',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  fontWeight: 600,
                  backdropFilter: 'blur(8px)',
                }}
              />
            </Box>
          </Box>

          <Box
            sx={{
              width: { xs: '100%', xl: 320 },
              display: 'grid',
              gap: 1.25,
            }}
          >
            <Box
              sx={{
                borderRadius: '18px',
                border: '1px solid rgba(255,255,255,0.12)',
                bgcolor: 'rgba(255,255,255,0.04)',
                px: 1.75,
                py: 1.5,
              }}
            >
              <Typography sx={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
                Drift akkurat nå
              </Typography>
              <Typography sx={{ mt: 0.6, fontWeight: 700, color: '#ffffff' }}>
                {accessOverview.platformAdmins} plattform-admin og {academyScopedCount} Academy-kontoer med utvidet tilgang.
              </Typography>
            </Box>

            <Box
              sx={{
                borderRadius: '18px',
                border: '1px solid rgba(255,255,255,0.12)',
                bgcolor: 'rgba(255,255,255,0.04)',
                px: 1.75,
                py: 1.5,
              }}
            >
              <Typography sx={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
                Oppfølging
              </Typography>
              <Typography sx={{ mt: 0.6, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                {pendingPaymentCount > 0
                  ? `${pendingPaymentCount} kontoer venter fortsatt på betalt aktivering.`
                  : 'Ingen kontoer venter på betalt aktivering akkurat nå.'}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            mt: 2.25,
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              xl: 'repeat(4, minmax(0, 1fr))',
            },
            gap: 1.25,
          }}
        >
          {[
            { key: 'users', label: 'Totale brukere', value: users.length, helper: 'Hele adminbasen' },
            { key: 'admins', label: 'Full admin', value: accessOverview.platformAdmins, helper: 'Plattform-kontroll' },
            { key: 'academy', label: 'Academy-tilgang', value: academyScopedCount, helper: 'Admin + redaktør' },
            { key: 'teamleads', label: 'Teamledere', value: teamLeadCount, helper: `${paidUserCount} betalte kontoer` },
          ].map((item) => (
            <Box
              key={item.key}
              sx={{
                borderRadius: '18px',
                border: '1px solid rgba(255,255,255,0.12)',
                bgcolor: 'rgba(255,255,255,0.04)',
                px: 1.75,
                py: 1.5,
              }}
            >
              <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {item.label}
              </Typography>
              <Typography variant="h5" sx={{ mt: 0.4, color: '#ffffff', fontWeight: 700 }}>
                {item.value}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 0.8, color: 'rgba(255,255,255,0.6)' }}>
                {item.helper}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Tabs for User Management and Invite Requests */}
      <Box
        sx={{
          mb: 3.5,
          p: 0.75,
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.10)',
          bgcolor: 'rgba(255,255,255,0.04)',
        }}
      >
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 0,
            '& .MuiTabs-indicator': {
              display: 'none',
            },
            '& .MuiTab-root': {
              minHeight: 40,
              textTransform: 'none',
              color: 'rgba(255,255,255,0.6)',
              borderRadius: '12px',
              px: 1.75,
              mr: 0.75,
              fontWeight: 600,
            },
            '& .Mui-selected': {
              bgcolor: 'rgba(255,255,255,0.04)',
              color: '#ffffff',
              boxShadow: '0 6px 18px rgba(24, 21, 18, 0.06)',
            },
          }}
        >
          <Tab 
            label="Brukere" 
            icon={<PeopleIcon />}
            iconPosition="start"
          />
          <Tab 
            label="Tilgangsforespørsler" 
            icon={<HowToRegIcon />}
            iconPosition="start"
          />
          <Tab
            label="E-post Design"
            icon={<EmailIcon />}
            iconPosition="start"
          />
          <Tab
            label="Mapper Tilgang"
            icon={<FolderIcon />}
            iconPosition="start"
          />
          <Tab
            label="Academy"
            icon={<SchoolIcon />}
            iconPosition="start"
          />
          <Tab
            label="Enterprise"
            icon={<BusinessIcon />}
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* Users Tab Content */}
      {tabValue === 0 && (
        <Box sx={{ display: 'grid', gap: 2.5 }}>
          {usersError ? (
            <Alert severity="error">
              {usersError instanceof Error ? usersError.message : 'Kunne ikke hente brukere'}
            </Alert>
          ) : null}
          {rolesError ? (
            <Alert severity="warning">
              {rolesError instanceof Error ? rolesError.message : 'Kunne ikke hente roller'}
            </Alert>
          ) : null}

          <Box sx={panelSurfaceSx}>
            <Box
              sx={{
                px: { xs: 2, sm: 3 },
                py: { xs: 2, sm: 2.5 },
                borderBottom: '1px solid rgba(255,255,255,0.10)',
                bgcolor: 'rgba(255,255,255,0.04)',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: { xs: 'stretch', lg: 'center' },
                  justifyContent: 'space-between',
                  gap: 2,
                  flexDirection: { xs: 'column', lg: 'row' },
                }}
              >
                <Box>
                    <Typography
                      variant="h6"
                    sx={{
                      fontWeight: 700,
                      color: '#ffffff',
                      letterSpacing: '-0.02em',
                    }}
                    >
                    Alle brukere{' '}
                    <Box component="span" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                      {filteredUsers.length}
                    </Box>
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.75, color: 'rgba(255,255,255,0.6)' }}>
                    Søk opp medlemmer, juster tilgang og fortsett godkjenninger uten å forlate tabellen.
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: 'flex',
                    gap: 1.25,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    justifyContent: { xs: 'stretch', lg: 'flex-end' },
                  }}
                >
                  <TextField
                    value={searchTerm}
                    onChange={(event) => {
                      setSearchTerm(event.target.value);
                      setUsersPage(1);
                    }}
                    placeholder="Søk i navn, e-post eller selskap"
                    size="small"
                    sx={{
                      width: { xs: '100%', sm: 240 },
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '12px',
                        bgcolor: 'rgba(255,255,255,0.04)',
                      },
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 18 }} />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <Box sx={{ position: 'relative', minWidth: 160 }}>
                    <FilterIcon
                      sx={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'rgba(255,255,255,0.6)',
                        fontSize: 18,
                        pointerEvents: 'none',
                        zIndex: 1,
                      }}
                    />
                    <FormControl size="small" fullWidth>
                      <Select
                        value={selectedRole}
                        displayEmpty
                        onChange={(event) => {
                          setSelectedRole(String(event.target.value));
                          setUsersPage(1);
                        }}
                        renderValue={(value) =>
                          value
                            ? roleById.get(String(value))?.name || String(value)
                            : 'Filtrer rolle'
                        }
                        sx={{
                          borderRadius: '12px',
                          bgcolor: 'rgba(255,255,255,0.04)',
                          pl: 2,
                        }}
                      >
                        <MenuItem value="">Alle roller</MenuItem>
                        {roles.map((role: Role) => (
                          <MenuItem key={role.id} value={role.id}>
                            {role.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>

                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setInviteDialogOpen(true)}
                    sx={{
                      borderRadius: '12px',
                      px: 2,
                      py: 1,
                      bgcolor: '#171410',
                      color: '#ffffff',
                      boxShadow: 'none',
                      '&:hover': {
                        bgcolor: '#2a241c',
                        boxShadow: 'none',
                      },
                    }}
                  >
                    Legg til bruker
                  </Button>
                </Box>
              </Box>
            </Box>

            <Box
              sx={{
                px: { xs: 2, sm: 3 },
                py: { xs: 2, sm: 2.5 },
                borderBottom: '1px solid rgba(255,255,255,0.10)',
                bgcolor: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <Alert
                severity="info"
                sx={{
                  mb: 2,
                  borderRadius: '14px',
                  border: '1px solid #dce7f5',
                  bgcolor: 'rgba(255,255,255,0.08)',
                }}
              >
                Plattform-adminer styrer roller og tilgang på tvers av CreatorHub. Academy-adminer er begrenset til Academy og vises separat her.
              </Alert>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    xl: 'repeat(4, minmax(0, 1fr))',
                  },
                  gap: 1.25,
                }}
              >
                {[
                  {
                    key: 'online-now',
                    label: 'Pålogget nå',
                    value: presence.onlineCount,
                    helper: 'Aktive siste 90 sek',
                    icon: <OnlineStatusDot online={presence.onlineCount > 0} size={12} label={`${presence.onlineCount} pålogget`} />,
                    sx: { bgcolor: 'rgba(34,197,94,0.12)', color: '#22c55e' },
                  },
                  {
                    key: 'platform',
                    label: 'Plattform-admin',
                    value: accessOverview.platformAdmins,
                    helper: 'Full kontroll',
                    icon: <SecurityIcon sx={{ fontSize: 18, color: '#86efac' }} />,
                    sx: { bgcolor: 'rgba(255,255,255,0.08)', color: '#86efac' },
                  },
                  {
                    key: 'academy-admin',
                    label: 'Academy-admin',
                    value: accessOverview.academyAdmins,
                    helper: 'Academy-styring',
                    icon: <SchoolIcon sx={{ fontSize: 18, color: '#93c5fd' }} />,
                    sx: { bgcolor: 'rgba(255,255,255,0.08)', color: '#93c5fd' },
                  },
                  {
                    key: 'academy-editor',
                    label: 'Academy-redaktør',
                    value: accessOverview.academyEditors,
                    helper: 'Innhold og kurs',
                    icon: <HowToRegIcon sx={{ fontSize: 18, color: '#c084fc' }} />,
                    sx: { bgcolor: 'rgba(255,255,255,0.08)', color: '#c084fc' },
                  },
                  {
                    key: 'standard',
                    label: 'Standardbrukere',
                    value: accessOverview.standardUsers,
                    helper: 'Ingen admin-tilgang',
                    icon: <PeopleIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.6)' }} />,
                    sx: { bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' },
                  },
                ].map((item) => (
                  <Box
                    key={item.key}
                    sx={{
                      border: '1px solid rgba(255,255,255,0.10)',
                      borderRadius: '16px',
                      px: 1.75,
                      py: 1.5,
                      bgcolor: 'rgba(255,255,255,0.04)',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                      <Box>
                        <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
                          {item.label}
                        </Typography>
                        <Typography variant="h5" sx={{ mt: 0.4, color: '#ffffff', fontWeight: 700 }}>
                          {item.value}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: '12px',
                          display: 'grid',
                          placeItems: 'center',
                          ...item.sx,
                        }}
                      >
                        {item.icon}
                      </Box>
                    </Box>
                    <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'rgba(255,255,255,0.6)' }}>
                      {item.helper}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            <AdminTableContainer ariaLabel="Brukere">
              <Table>
                <TableHead>
                  <TableRow
                    sx={{
                      '& .MuiTableCell-root': {
                        bgcolor: 'rgba(255,255,255,0.04)',
                        borderBottom: '1px solid rgba(255,255,255,0.10)',
                        color: 'rgba(255,255,255,0.6)',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        py: 1.5,
                      },
                    }}
                  >
                    <TableCell padding="checkbox" sx={{ width: 52 }}>
                      <Checkbox size="small" />
                    </TableCell>
                    <TableCell>Navn</TableCell>
                    <TableCell>Bedrift</TableCell>
                    <TableCell>Tilgang</TableCell>
                    <TableCell>Abonnement</TableCell>
                    <TableCell align="left">Sist aktiv</TableCell>
                    <TableCell align="left">Opprettet</TableCell>
                    <TableCell align="center" sx={{ width: 72 }}>
                      Handlinger
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {usersLoading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <TableRow key={index}>
                        {Array.from({ length: 8 }).map((_, cellIndex) => (
                          <TableCell key={cellIndex}>
                            <Skeleton variant="text" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    paginatedUsers.map((user: User) => (
                      <TableRow
                        key={user.id}
                        hover
                        sx={{
                          '& .MuiTableCell-root': {
                            borderBottom: '1px solid #f4efe7',
                            py: 1.5,
                          },
                        }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox size="small" />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ position: 'relative', flexShrink: 0 }}>
                              <Avatar
                                src={user.profileImageUrl || undefined}
                                sx={{
                                  width: 36,
                                  height: 36,
                                  bgcolor: 'rgba(255,255,255,0.08)',
                                  color: '#ffffff',
                                  fontWeight: 700,
                                  fontSize: '0.9rem',
                                }}
                              >
                                {(user.firstName?.[0] || user.email[0]).toUpperCase()}
                              </Avatar>
                              <Box
                                sx={{
                                  position: 'absolute',
                                  bottom: -1,
                                  right: -1,
                                  borderRadius: '50%',
                                  p: '2px',
                                  bgcolor: '#0f1729',
                                  lineHeight: 0,
                                }}
                              >
                                <OnlineStatusDot
                                  online={presence.isOnline(user.id) || presence.isOnline(user.email)}
                                  size={9}
                                />
                              </Box>
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 700,
                                  color: '#ffffff',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {formatUserName(user)}
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{
                                  display: 'block',
                                  mt: 0.35,
                                  color: 'rgba(255,255,255,0.6)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {user.email}
                                {user.businessName || user.companyName
                                  ? ` · ${user.businessName || user.companyName}`
                                  : ''}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.45 }}>
                            <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                              {user.businessName || user.companyName || user.roleRoomAccess?.companyName || 'Ikke oppgitt'}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                              Org.nr. {formatOrganizationNumber(user.organizationNumber || user.roleRoomAccess?.organizationNumber)}
                            </Typography>
                            {getSourceChip(getEffectiveSource(user)) ? (
                              <Chip
                                label={getSourceChip(getEffectiveSource(user))?.label}
                                size="small"
                                sx={{
                                  width: 'fit-content',
                                  height: 22,
                                  borderRadius: '999px',
                                  fontWeight: 700,
                                  fontSize: '0.68rem',
                                  ...getSourceChip(getEffectiveSource(user))?.sx,
                                }}
                              />
                            ) : null}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.7 }}>
                            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                              {getAccessPills(user).map((pill) => (
                                <Chip
                                  key={`${user.id}-${pill.key}`}
                                  label={pill.label}
                                  size="small"
                                  sx={{
                                    height: 24,
                                    borderRadius: '999px',
                                    fontWeight: 700,
                                    fontSize: '0.72rem',
                                    ...pill.sx,
                                  }}
                                />
                              ))}
                            </Box>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                              {getAccessScopePresentation(user).description}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.55 }}>
                            <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
                              {user.planName || user.selectedPlan || user.roleRoomAccess?.subscriptionLabel ? (
                                <Chip
                                  label={user.planName || user.roleRoomAccess?.subscriptionLabel || user.selectedPlan}
                                  size="small"
                                  sx={{
                                    height: 24,
                                    borderRadius: '999px',
                                    fontWeight: 700,
                                    fontSize: '0.7rem',
                                    bgcolor: 'rgba(255,255,255,0.08)',
                                    color: '#ffffff',
                                  }}
                                />
                              ) : null}
                              <Chip
                                label={user.paymentCompleted ? 'Betalt' : 'Venter betaling'}
                                size="small"
                                sx={{
                                  height: 24,
                                  borderRadius: '999px',
                                  fontWeight: 700,
                                  fontSize: '0.7rem',
                                  bgcolor: user.paymentCompleted ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.08)',
                                  color: user.paymentCompleted ? '#86efac' : '#fbbf24',
                                }}
                              />
                              {user.roleRoomAccess?.isTeamLeader ? (
                                <Chip
                                  label="Teamleder"
                                  size="small"
                                  sx={{
                                    height: 24,
                                    borderRadius: '999px',
                                    fontWeight: 700,
                                    fontSize: '0.7rem',
                                    bgcolor: 'rgba(255,255,255,0.08)',
                                    color: '#93c5fd',
                                  }}
                                />
                              ) : null}
                              {getRoleRoomActivationChip(user) ? (
                                <Chip
                                  label={getRoleRoomActivationChip(user)?.label}
                                  size="small"
                                  sx={{
                                    height: 24,
                                    borderRadius: '999px',
                                    fontWeight: 700,
                                    fontSize: '0.7rem',
                                    ...getRoleRoomActivationChip(user)?.sx,
                                  }}
                                />
                              ) : null}
                            </Box>
                            {user.roleRoomAccess?.memberRoleLabel ? (
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                                {user.roleRoomAccess.memberRoleLabel}
                              </Typography>
                            ) : null}
                            {user.roleRoomAccess?.teamSize ? (
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                                {`${user.roleRoomAccess.teamSize} personer · ${formatCurrencyNok(user.roleRoomAccess.monthlyTotalExVat) || 'Pris ikke satt'} / mnd eks. mva.`}
                              </Typography>
                            ) : user.planPrice ? (
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                                {`${formatCurrencyNok(user.planPrice)} / mnd eks. mva.`}
                              </Typography>
                            ) : null}
                            {user.paymentTimestamp ? (
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                                {`Betalt ${formatUserDate(user.paymentTimestamp)}`}
                              </Typography>
                            ) : null}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: '#ffffff' }}>
                            {formatUserDate(user.lastLoginAt || user.updatedAt)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: '#ffffff' }}>
                            {formatUserDate(user.createdAt)}
                          </Typography>
                          {user.approvedAt ? (
                            <Typography variant="caption" sx={{ display: 'block', mt: 0.3, color: 'rgba(255,255,255,0.6)' }}>
                              {`Godkjent ${formatUserDate(user.approvedAt)}`}
                            </Typography>
                          ) : null}
                          {user.approvedBy ? (
                            <Typography variant="caption" sx={{ display: 'block', mt: 0.2, color: 'rgba(255,255,255,0.6)' }}>
                              {`Godkjent av ${user.approvedBy}`}
                            </Typography>
                          ) : null}
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Handlinger">
                            <IconButton size="small" onClick={(event) => handleMenuClick(event, user)}>
                              <MoreVertIcon sx={{ color: 'rgba(255,255,255,0.6)' }} />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}

                  {!usersLoading && filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <Alert severity="info" sx={{ my: 2 }}>
                          Ingen brukere matcher søket eller filteret.
                        </Alert>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </AdminTableContainer>

            {filteredUsers.length > 8 ? (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  px: 3,
                  py: 2.25,
                  borderTop: '1px solid rgba(255,255,255,0.10)',
                  bgcolor: 'rgba(255,255,255,0.04)',
                }}
              >
                <Pagination
                  count={totalUserPages}
                  page={usersPage}
                  onChange={(_, value) => setUsersPage(value)}
                  shape="rounded"
                  siblingCount={0}
                  sx={{
                    '& .MuiPaginationItem-root': {
                      color: 'rgba(255,255,255,0.6)',
                    },
                    '& .Mui-selected': {
                      bgcolor: '#171410 !important',
                      color: '#fff',
                    },
                  }}
                />
              </Box>
            ) : null}
          </Box>
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
        <Box sx={{ display: 'grid', gap: 2.5 }}>
          <Box
            sx={{
              ...panelSurfaceSx,
              background:
                'linear-gradient(135deg, rgba(15,23,42,0.94), rgba(255,255,255,0.04))',
            }}
          >
            <Box sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2.5, sm: 3 } }}>
              <Chip
                label="CreatorHub e-postdesigner"
                size="small"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.08)',
                  color: '#fbbf24',
                  fontWeight: 700,
                  borderRadius: '999px',
                }}
              />
              <Typography
                variant="h5"
                sx={{
                  mt: 2,
                  fontWeight: 700,
                  color: '#ffffff',
                  letterSpacing: '-0.03em',
                  maxWidth: 560,
                }}
              >
                Faste maler ligger nå inne i designeren under fanen "Maler"
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  mt: 1.2,
                  maxWidth: 620,
                  color: 'rgba(255,255,255,0.6)',
                  lineHeight: 1.7,
                }}
              >
                Der finner admin ferdige CreatorHub-maler for godkjenning, onboarding,
                oppfølging og driftsmeldinger. Malene er språkvasket og satt opp med logo,
                bunntekst og tydelig struktur.
              </Typography>
            </Box>
          </Box>

          <Alert
            severity="info"
            sx={{
              borderRadius: '18px',
              border: '1px solid #dce7f5',
              bgcolor: 'rgba(255,255,255,0.08)',
              '& .MuiAlert-message': { width: '100%' },
            }}
          >
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
              <strong>Tilgjengelige variabler:</strong> <code>{'{{firstName}}'}</code>,
              <code>{' {{lastName}}'}</code>, <code>{' {{email}}'}</code>,
              <code>{' {{profession}}'}</code>, <code>{' {{companyName}}'}</code>,
              <code>{' {{loginUrl}}'}</code>, <code>{' {{dashboardUrl}}'}</code>. De anbefalte
              malene under fanen "Maler" i designeren er allerede lagt opp for å bruke disse der
              det passer.
            </Typography>
          </Alert>

          <Box sx={panelSurfaceSx}>
            <Box
              sx={{
                px: { xs: 2, sm: 3 },
                py: { xs: 2, sm: 2.5 },
                borderBottom: '1px solid rgba(255,255,255,0.10)',
                bgcolor: 'rgba(255,255,255,0.04)',
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#ffffff' }}>
                Design arbeidsflate
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.75, color: 'rgba(255,255,255,0.6)' }}>
                Velg en av de anbefalte malene inne i designeren, eller start fra en ny tom mal.
              </Typography>
            </Box>

            <Box sx={{ height: '78vh', minHeight: 760 }}>
              <EmailDesigner
                context="general"
                profession="admin"
                presetTemplates={ADMIN_EMAIL_DESIGNER_PRESETS}
                onSave={(template) => {
                  console.log('Email template saved:', template);
                }}
              />
            </Box>
          </Box>
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
                  value={folderViewUserId || ''}
                  onChange={(e) => setFolderViewUserId(e.target.value)}
                  label="Velg Bruker"
                >
                  <MenuItem value="">
                    <em>Velg en bruker...</em>
                  </MenuItem>
                  {users.map((user: User) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} ({user.email}) - {user.profession || 'Ingen profesjon'}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Folder Access Viewer */}
              {folderViewUserId && (() => {
                const selectedUserData = users.find((u: User) => u.id === folderViewUserId);
                if (!selectedUserData) return null;

                // Get user's plan (default to basic if not set)
                const userPlan: 'basic' | 'pro' | 'enterprise' = 'basic'; // TODO: Get from user metadata

                // Get enabled features for user
                const professionFeatures = getAllProfessionFeatures(selectedUserData.profession || 'photographer');
                const enabledFeatures = professionFeatures
                  .filter((feature: any) => feature.enabled)
                  .map((feature: any) => feature.featureId)
                  .filter(Boolean);

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

          {/* Slice 9X.70 — installasjoner + Stripe-abonnement per bruker */}
          <Box sx={{ mt: 3 }}>
            <UserInstallationsPanel users={users} />
          </Box>
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
              <Typography variant="h6" gutterBottom sx={{ color: '#ce93d8', display: 'flex', alignItems:'center', gap: 1 }}>
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

      {/* Error Snackbar */}
      <Snackbar
        open={errorSnackbar.open}
        autoHideDuration={6000}
        onClose={() => setErrorSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setErrorSnackbar({ open: false, message: '' })}
          severity="error"
          sx={{ width: '100%' }}
        >
          {errorSnackbar.message}
        </Alert>
      </Snackbar>
    </Box>
    </ThemeProvider>
  );
}
