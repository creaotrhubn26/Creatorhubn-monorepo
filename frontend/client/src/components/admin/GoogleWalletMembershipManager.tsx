/**
 * CreatorHub Norge - Google Wallet Membership Manager
 * Digital Membership Cards for Platform Users
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
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
  Alert,
  Tabs,
  Tab,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Switch,
  FormControlLabel,
  Tooltip,
  Badge,
  Avatar,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  QrCode as QrCodeIcon,
  CardMembership as MembershipIcon,
  Group as GroupIcon,
  Star as StarIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  Refresh as AutoRenewIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  School as SchoolIcon,
  Work as WorkIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface MembershipCard {
  id: string;
  passId: string;
  userId: string;
  organizationName: string;
  membershipType: string;
  memberNumber: string;
  memberSince: string;
  benefits: string[];
  renewalDate?: string;
  isActive: boolean;
  autoRenew: boolean;
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  qrCode?: string;
  barcode?: string;
  createdAt: string;
  lastRenewedAt?: string;
}

interface MembershipCardFormData {
  organizationName: string;
  membershipType: string;
  memberNumber: string;
  memberSince: string;
  benefits: string[];
  renewalDate?: string;
  autoRenew: boolean;
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
}

interface GoogleWalletMembershipManagerProps {
  className?: string;
  // Integration props for unified workflow connectivity
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

export default function GoogleWalletMembershipManager({
  className,
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
}: GoogleWalletMembershipManagerProps) {
  const [tabValue, setTabValue] = useState(0);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedCard, setSelectedCard] = useState<MembershipCard | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Master integration system for "everything interacts with everything"
  const { integration, communication, dataFlow, componentRegistry, auth } = useEnhancedMasterIntegration();
  const user = auth.user;
  
  // Theming system
  const theming = useTheming('prototype_tester, ');

  // Register component and data flow nodes with MasterIntegrationProvider
  useEffect(() => {
    try {
      (componentRegistry as any).registerComponent?.('google-wallet-membership', {
        type: 'admin',
        category: 'membership'
    });
  } catch (e) {
      console.log('Component registry not available, ');
  }

    return () => {
      try {
        (componentRegistry as any).unregisterComponent?.('google-wallet-membership');
    } catch (e) {
        // Ignore
    }
  };
}, [componentRegistry]);

  // Listen to global events from other components
  useEffect(() => {
    const unsubscribe = communication.onMessage((message: any) => {
      if (message.type === 'project:selected' && message.data) {
        console.log('🎫 Google Wallet Membership: Project selected, ', message.data);
        // Update membership context based on selected project
    }
      if (message.type === 'client:selected' && message.data) {
        console.log('🎫 Google Wallet Membership: Client selected, ', message.data);
        // Update membership context based on selected client
    }
      if (message.type === 'data:sync' && message.data.dataKey === 'google-wallet-membership:cards') {
        console.log('🎫 Google Wallet Membership: Cards synced, ', message.data.data);
    }
  });
    return unsubscribe;
}, [communication]);

  // Fetch membership cards
  const { data: membershipCards = [], isLoading: cardsLoading } = useQuery({
    queryKey: ['/api/google-wallet/membership-cards', user?.id],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/google-wallet/membership-cards/${user?.id}`, { headers });
    },
    enabled: !!user?.id,
});

  // Fetch organizations
  const { data: organizations = [] } = useQuery({
    queryKey: ['/api/google-wallet/organizations'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/google-wallet/organizations', { headers });
    },
});

  // Create membership card mutation
  const createMembershipCardMutation = useMutation({
    mutationFn: async (data: MembershipCardFormData) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/google-wallet/create-membership-card', {
        method: 'POST',
        headers: {
          ...headers, 'Content-Type' : 'application/json'
        },
        body: JSON.stringify({
          userId: user?.id,
          ...data
        })
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/google-wallet/membership-cards'] });
      setShowCreateDialog(false);
      toast({
        title: 'Membership Card Created',
        description: 'Digital membership card has been created successfully',
        variant: 'default',
    });

      // Broadcast to other components
      communication.sendBroadcast('membership:cardCreated', result);

      // Sync data flow
      (dataFlow as any).syncData?.('google-wallet-membership:cards', result);
  },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to create membership card',
        variant: 'destructive',
    });
  }
});

  // Update membership card mutation
  const updateMembershipCardMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MembershipCardFormData> }) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/google-wallet/membership-cards/${id}`, {
        method: 'PUT',
        headers: {
          ...headers, 'Content-Type' : 'application/json'
        },
        body: JSON.stringify(data)
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/google-wallet/membership-cards'] });
      setShowEditDialog(false);
      toast({
        title: 'Membership Card Updated',
        description: 'Digital membership card has been updated successfully',
        variant: 'default',
    });

      // Broadcast to other components
      communication.sendBroadcast('membership:cardUpdated', result);

      // Sync data flow
      (dataFlow as any).syncData?.('google-wallet-membership:cards', result);
  },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update membership card',
        variant: 'destructive',
    });
  }
});

  // Delete membership card mutation
  const deleteMembershipCardMutation = useMutation({
    mutationFn: async (id: string) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/google-wallet/membership-cards/${id}`, {
        method: 'DELETE',
        headers
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/google-wallet/membership-cards'] });
      toast({
        title: 'Membership Card Deleted',
        description: 'Digital membership card has been deleted successfully',
        variant: 'default',
    });
      
      // Broadcast to other components
      communication.sendBroadcast('membership:cardDeleted', {
        cardId: result.id
    });
  },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to delete membership card',
        variant: 'destructive',
    });
  }
});

  // Sync membership data on component mount and data changes
  useEffect(() => {
    (dataFlow as any).syncData?.('google-wallet-membership:cards', membershipCards);
    (dataFlow as any).syncData?.('google-wallet-membership:organizations', organizations);
}, [dataFlow, membershipCards, organizations]);

  // Handle tab changes and broadcast them
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    
    // Broadcast tab change to other components
    communication.sendBroadcast('membership:tabChanged', {
      tabValue: newValue,
      tabName: ['My Cards','Organizations','Templates','Settings'][newValue] || 'Unknown'
  });
};

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'PLATINUM': return 'primary';
      case 'GOLD': return 'warning';
      case 'SILVER': return 'default';
      case 'BRONZE': return 'secondary';
      default: return 'default';
}
};

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'PLATINUM': return <StarIcon color="primary" />;
      case 'GOLD': return <StarIcon color="warning" />;
      case 'SILVER': return <StarIcon color="action" />;
      case 'BRONZE': return <StarIcon color="disabled" />;
      default: return <StarIcon />;
}
};

  const getMembershipTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'professional': return <WorkIcon />;
      case 'business': return <BusinessIcon />;
      case 'student': return <SchoolIcon />;
      case 'individual': return <PersonIcon />;
      default: return <MembershipIcon />;
}
};

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('no-NO');
};

  const isExpiringSoon = (renewalDate?: string) => {
    if (!renewalDate) return false;
    const renewal = new Date(renewalDate);
    const now = new Date();
    const daysUntilRenewal = Math.ceil((renewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilRenewal <= 30 && daysUntilRenewal > 0;
};

  const isExpired = (renewalDate?: string) => {
    if (!renewalDate) return false;
    const renewal = new Date(renewalDate);
    const now = new Date();
    return renewal < now;
};

  return (
    <Box className={className}>
      <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
        <MembershipIcon color="primary" />
        Google Wallet - Digital Membership Cards
      </Typography>

      {/* Stats Overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <MembershipIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                    {membershipCards.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Cards
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'success.main' }}>
                  <CheckCircleIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" color="success.main" sx={{ color: theming.colors.primary }}>
                    {membershipCards.filter((card: any) => card.isActive).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Cards
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'warning.main' }}>
                  <WarningIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" color="warning.main" sx={{ color: theming.colors.primary }}>
                    {membershipCards.filter((card: any) => isExpiringSoon(card.renewalDate)).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Expiring Soon
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'error.main' }}>
                  <ScheduleIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" color="error.main" sx={{ color: theming.colors.primary }}>
                    {membershipCards.filter((card: any) => isExpired(card.renewalDate)).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Expired
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="My Cards" />
          <Tab label="Organizations" />
          <Tab label="Templates" />
          <Tab label="Settings" />
        </Tabs>
      </Box>

      {/* My Cards Tab */}
      {tabValue === 0 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Digital Membership Cards
            </Typography>
            <Button variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowCreateDialog(true)}
              sx={{ 
                background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                color: 'white'
          }}
            >
              Create New Card
            </Button>
          </Box>

          <Grid container spacing={3}>
            {membershipCards.map((card: any) => (
              <Grid item xs={12} sm={6} md={4} key={card.id}>
                <Card 
                  sx={{ 
                    height: '100%',
                    border: isExpiringSoon(card.renewalDate) ? '2px solid #ff9800' : 
                           isExpired(card.renewalDate) ? '2px solid #f44336' : '1px solid #e0e0e0',
                    position: 'relative'
                }}
                >
                  {isExpiringSoon(card.renewalDate) && (
                    <Chip
                      label="Expires Soon"
                      color="warning"
                      size="small"
                      sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1}}
                    />
                  )}
                  {isExpired(card.renewalDate) && (
                    <Chip
                      label="Expired"
                      color="error"
                      size="small"
                      sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1}}
                    />
                  )}

                  <CardContent sx={theming.getThemedCardSx()}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      {getMembershipTypeIcon(card.membershipType)}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" noWrap sx={{ color: theming.colors.primary }}>
                          {card.organizationName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {card.membershipType}
                        </Typography>
                      </Box>
                      {getTierIcon(card.tier)}
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Member #{card.memberNumber}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Since: {formatDate(card.memberSince)}
                      </Typography>
                      {card.renewalDate && (
                        <Typography variant="body2" color="text.secondary">
                          Renewal: {formatDate(card.renewalDate)}
                        </Typography>
                      )}
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Chip
                        label={card.tier}
                        color={getTierColor(card.tier) as any}
                        size="small"
                        sx={{ mr: 1 }}
                      />
                      <Chip
                        label={card.isActive ? 'Active' : 'Inactive'}
                        color={card.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton size="small" onClick={() => setSelectedCard(card)}>
                        <ViewIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => {
                        setSelectedCard(card);
                        setShowEditDialog(true);
                    }}>
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => {
                        if (window.confirm('Are you sure you want to delete this membership card?')) {
                          deleteMembershipCardMutation.mutate(card.id);
                      }
                    }}>
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {membershipCards.length === 0 && (
            <Paper sx={{ p: 4, textAlign: 'center' }} component="div">
              <MembershipIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom sx={{ color: theming.colors.primary }}>
                No Membership Cards
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Create your first digital membership card to get started
              </Typography>
              <Button variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setShowCreateDialog(true)}
              >
                Create Membership Card
              </Button>
            </Paper>
          )}
        </Box>
      )}

      {/* Organizations Tab */}
      {tabValue === 1 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 3, color: theming.colors.primary }}>
            Available Organizations
          </Typography>
          <Grid container spacing={3}>
            {organizations.map((org: any) => (
              <Grid item xs={12} sm={6} md={4} key={org.id}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        <BusinessIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>{org.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {org.type}
                        </Typography>
                      </Box>
                    </Box>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      {org.description}
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => {
                        setShowCreateDialog(true);
                        // Pre-fill organization data
                    }}
                    >
                      Join Organization
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Templates Tab */}
      {tabValue === 2 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 3, color: theming.colors.primary }}>
            Membership Card Templates
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={4}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <WorkIcon color="primary" />
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>Professional</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    For professional photographers, videographers, and creatives
                  </Typography>
                  <Button variant="outlined" size="small">
                    Use Template
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <BusinessIcon color="primary" />
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>Business</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    For business owners and entrepreneurs
                  </Typography>
                  <Button variant="outlined" size="small">
                    Use Template
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <SchoolIcon color="primary" />
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>Student</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    For students and educational memberships
                  </Typography>
                  <Button variant="outlined" size="small">
                    Use Template
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Settings Tab */}
      {tabValue === 3 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 3, color: theming.colors.primary }}>
            Google Wallet Settings
          </Typography>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <AutoRenewIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Auto-renewal"
                    secondary="Automatically renew expiring memberships"
                  />
                  <Switch defaultChecked />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <QrCodeIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="QR Code Display"
                    secondary="Show QR codes on membership cards"
                  />
                  <Switch defaultChecked />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <ShareIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Share Cards"
                    secondary="Allow sharing of membership cards"
                  />
                  {theming.getThemedIcon('switch')}
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || showEditDialog} onClose={() => {
        setShowCreateDialog(false);
        setShowEditDialog(false);
        setSelectedCard(null);
    }} maxWidth="md" fullWidth>
        <DialogTitle>
          {showCreateDialog ? 'Create Membership Card' : 'Edit Membership Card'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Organization Name"
                defaultValue={selectedCard?.organizationName || ', '}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Membership Type</InputLabel>
                <Select defaultValue={selectedCard?.membershipType || 'Professional'}>
                  <MenuItem value="Professional">Professional</MenuItem>
                  <MenuItem value="Business">Business</MenuItem>
                  <MenuItem value="Student">Student</MenuItem>
                  <MenuItem value="Individual">Individual</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Member Number"
                defaultValue={selectedCard?.memberNumber || ', '}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Tier</InputLabel>
                <Select defaultValue={selectedCard?.tier || 'BRONZE'}>
                  <MenuItem value="BRONZE">Bronze</MenuItem>
                  <MenuItem value="SILVER">Silver</MenuItem>
                  <MenuItem value="GOLD">Gold</MenuItem>
                  <MenuItem value="PLATINUM">Platinum</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Member Since"
                type="date"
                defaultValue={selectedCard?.memberSince || new Date().toISOString().split('T')[0]}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Renewal Date"
                type="date"
                defaultValue={selectedCard?.renewalDate || ', '}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Benefits (one per line)"
                multiline
                rows={3}
                defaultValue={selectedCard?.benefits?.join('\n') || ','}
                placeholder="Priority support&#10;Exclusive content&#10;Discounts on services"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch defaultChecked={selectedCard?.autoRenew || false} />}
                label="Auto-renewal"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowCreateDialog(false);
            setShowEditDialog(false);
            setSelectedCard(null);
        }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              // Handle form submission
              if (showCreateDialog) {
                createMembershipCardMutation.mutate({
                  organizationName: 'Test Organization',
                  membershipType: 'Professional',
                  memberNumber: 'MEM001',
                  memberSince: new Date().toISOString(),
                  benefits: ['Priority support','Exclusive content'],
                  autoRenew: true,
                  tier: 'GOLD'
              });
            } else {
                updateMembershipCardMutation.mutate({
                  id: selectedCard?.id || ', ',
                  data: {
                    organizationName: 'Updated Organization',
                    membershipType: 'Professional',
                    memberNumber: 'MEM001',
                    memberSince: new Date().toISOString(),
                    benefits: ['Priority support','Exclusive content'],
                    autoRenew: true,
                    tier: 'GOLD'
                }
              });
            }
          }}
            disabled={createMembershipCardMutation.isPending || updateMembershipCardMutation.isPending}
            sx={theming.getThemedButtonSx()}
          >
            {showCreateDialog ? 'Create Card' : 'Update Card'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


