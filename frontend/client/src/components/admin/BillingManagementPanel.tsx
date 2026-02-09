/**
 * CreatorHub Norge - Billing Management Panel  
 * Complete billing administration for plans, invoices, and coupons
 */

import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import getProfessionIcon from '@/utils/profession-icons';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
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
  Tab,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  ListItemIcon,
  InputAdornment
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  AttachMoney as MoneyIcon,
  Receipt as InvoiceIcon,
  LocalOffer as CouponIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Assessment as ReportsIcon,
  TrendingUp,
  Analytics as AnalyticsIcon,
  MoneyOff as RefundIcon,
  Pause as PauseIcon,
  CreditCard as PaymentIcon,
  CheckCircle,
  Cancel,
  Pending,
  AccountBalance as SplitSheetIcon,
} from '@mui/icons-material';
import BillingAnalytics from './BillingAnalytics';
import RefundRequestsTable from './RefundRequestsTable';
import PaymentMethodsTable from './PaymentMethodsTable';
import { useToast } from '@/hooks/use-toast';
import ReportsPanel from './ReportsPanel';
import PriceManagementDashboard from './PriceManagementDashboard';
import { usePlatformPricing } from '../../services/PlatformPricingService';

interface BillingPlan {
  id: string;
  name: string;
  profession: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
  active: boolean;
  createdAt: string;
  maxUsers: number;
  maxProjects: number;
  storageLimit: number;
}

interface Invoice {
  id: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  planId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  paidAt?: string;
  dueAt?: string;
  periodStart: string;
  periodEnd: string;
}

interface Coupon {
  id: string;
  code: string;
  name: string;
  discountType: string;
  discountValue: number;
  currency: string;
  maxRedemptions: number;
  timesRedeemed: number;
  active: boolean;
  expiresAt: string;
  createdAt: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

// Integration props for unified workflow connectivity
interface BillingManagementPanelProps {
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

export default function BillingManagementPanel({
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
}: BillingManagementPanelProps) {
  const [tabValue, setTabValue] = useState(0);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [couponDialogOpen, setCouponDialogOpen] = useState(false);
  const [splitSheetInvoiceDialogOpen, setSplitSheetInvoiceDialogOpen] = useState(false);
  const [selectedSplitSheet, setSelectedSplitSheet] = useState<any>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const profession = (user as any)?.profession || 'photographer';
  const isMusicProducer = profession === 'music_producer';

  // Master integration system for "everything interacts with everything"
  const { communication, dataFlow, componentRegistry } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('prototype_tester');

  // Profession system integration
  const { professionConfigs: allConfigs } = useProfessionConfigs();

  // Platform pricing service integration
  const { 
    subscriptionPlans, 
    features, 
    formatPrice, 
    isLoading: pricingLoading 
} = usePlatformPricing();

  // Menu state for item actions
  const menuOpen = Boolean(anchorEl);
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, item: any) => {
    setAnchorEl(event.currentTarget);
    setSelectedItem(item);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedItem(null);
  };

  // Register component and data flow nodes with MasterIntegrationProvider
  useEffect(() => {
    componentRegistry.registerComponent({
      id: 'billing-management,',
      name: 'Billing Management',
      type: 'admin',
      category: 'administration',
      capabilities: [
        'data:read','data:write','event:emit','event:listen','ui:update','billing:plan','billing:invoice','billing:coupon','notification:create','project:update','client:update'
      ],
      dependencies: [],
      props: [],
      events: [],
      dataKeys: ['billing-management:plans','billing-management:invoices','billing-management:coupons']
  });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'billing-management',
      dataKey: 'billing-management:plans',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now() })
  });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'billing-management',
      dataKey: 'billing-management:invoices',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now() })
  });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'billing-management',
      dataKey: 'billing-management:coupons',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now() })
  });

    return () => {
      componentRegistry.unregisterComponent('billing-management');
  };
}, [componentRegistry, dataFlow]);

  // Listen to global events from other components
  useEffect(() => {
    const communicationUnsubscribe = communication.onMessage((message: any) => {
      if (message.type === 'project:selected' && message.data) {
        console.log('💰 Billing Management: Project selected, ', message.data);
        // Update billing context and trigger project select handler
        if (onProjectSelect) {
          onProjectSelect(message.data);
        }
      }
      if (message.type === 'client: selected' && message.data) {
        console.log('💰 Billing Management: Client selected', message.data);
        // Update billing context and trigger client select handler
        if (onClientSelect) {
          onClientSelect(message.data);
        }
        // Auto-create showcase for new client billing setup
        if (onShowcaseCreate && message.data.isNew) {
          onShowcaseCreate({
            clientId: message.data.id,
            title: `Billing Showcase for ${message.data.name}`,
            type: 'billing_portfolio'
          });
        }
      }
      if (message.type === 'data: sync' && message.data.dataKey === 'billing-management:plans') {
        console.log('💰 Billing Management: Plans synced', message.data.data);
        // Trigger file download for plan documents
        if (onFileDownload && message.data.data.documentsAvailable) {
          onFileDownload({
            type: 'plan_documents',
            planId: message.data.data.id,
            filename: `plan_${message.data.data.id}_documents.pdf`
          });
        }
      }
    });

    return () => communicationUnsubscribe();
}, [communication, onProjectSelect, onClientSelect, onShowcaseCreate, onFileDownload]);

  // Integration handlers for unified workflow system
  const handlePlanCreated = (planData: any) => {
    console.log('💰 Billing Plan Created: ', planData);
    
    // Broadcast to other components via integration system
    communication.sendMessage({
      from: 'billing-management',
      to: 'all',
      type: 'billing:planCreated',
      priority: 'medium',
      data: {
        ...planData,
        createdBy: 'billing-management',
        timestamp: Date.now()
  }
  });
    // Sync data flow
    dataFlow.syncData('billing-management:plans', planData);
    
    // Trigger unified workflow events for project updates
    if (onProjectUpdate && selectedProject) {
      onProjectUpdate({
        ...selectedProject,
        billingPlan: planData,
        lastBillingUpdate: new Date().toISOString()
  });
  }

    // Trigger client updates if applicable
    if (onClientUpdate && selectedClient) {
      onClientUpdate({
        ...selectedClient,
        billingPlans: [...(selectedClient.billingPlans || []), planData]
      });
    }

    // Auto-create meeting for billing review if handler provided
    if (onMeetingCreate) {
      onMeetingCreate({
        title: `Billing Plan Review: ${planData.name}`,
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'billing_review',
        planId: planData.id
      });
    }
    
    if (onNotificationCreate) {
      onNotificationCreate({
        id: `plan_created_${Date.now()}`,
        type: 'billing_plan_created',
        title: 'New Billing Plan Created',
        message: `Plan "${planData.name}" created successfully`,
        priority: 'medium',
        timestamp: new Date().toISOString(),
        source: 'billing_management'
  });
  }
};

  const handleCouponCreated = (couponData: any) => {
    console.log('🎫 Billing Coupon Created:', couponData);
    
    // Broadcast via integration and communication
    communication.sendMessage({
      from: 'billing-management',
      to: 'all',
      type: 'billing:couponCreated',
      priority: 'medium',
      data: {
        ...couponData,
        createdBy: 'billing-management',
        timestamp: Date.now()
  }
  });

    // Sync data flow
    dataFlow.syncData('billing-management:coupons', couponData);

    // Trigger worklog if applicable
    if (onWorklogCreate) {
      onWorklogCreate({
        activity: 'created_coupon',
        description: `Created coupon ${couponData.code}`,
        timestamp: new Date().toISOString(),
        metadata: { couponId: couponData.id, code: couponData.code }
      });
    }
    
    if (onNotificationCreate) {
      onNotificationCreate({
        id: `coupon_created_${Date.now()}`,
        type: 'billing_coupon_created',
        title: 'New Coupon Created',
        message: `Coupon "${couponData.code}" created successfully`,
        priority: 'low',
        timestamp: new Date().toISOString(),
        source: 'billing_management'
  });
  }
};

  // Handle tab changes and broadcast them
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    
    // Broadcast tab change to other components
    communication.sendMessage({
      from: 'billing-management',
      to: 'all',
      type: 'billing:tabChanged',
      priority: 'low',
      data: { 
        tabValue: newValue,
        tabName: ['Plans','Invoices','Coupons','Reports'][newValue] || 'Unknown',
        timestamp: Date.now()
  }
  });
};

  // Sync billing data on component mount and data changes
  useEffect(() => {
    // This would sync actual data when it's fetched
    // dataFlow.syncData('billing-management: plans', plansData);
    // dataFlow.syncData('billing-management: invoices', invoicesData);
    // dataFlow.syncData('billing-management: coupons', couponsData);
}, [dataFlow]);

  // Fetch data with proper headers using apiRequest
  const fetchWithAuth = async (url: string) => {
    return apiRequest(url, {
      headers: {
        'Authorization': `Bearer ${user?.id || ''}`,
        'x-user-email': user?.email || ''
      }
    });
  };
  
  // Handle menu actions for items
  const handleMenuAction = async (action: 'edit' | 'view' | 'delete') => {
    if (!selectedItem) return;
    
    switch (action) {
      case 'view':
        toast({
          title: "Viewing item",
          description: `Viewing details for ${selectedItem.name || selectedItem.code || selectedItem.id}`,
          variant: "default"
        });
        if (onProjectSelect && selectedItem.id) {
          onProjectSelect({ id: selectedItem.id, type: 'billing_item' });
        }
        break;
      case 'edit':
        toast({
          title: "Edit mode",
          description: `Edit ${selectedItem.name || selectedItem.code || selectedItem.id}`,
          variant: "default"
        });
        if (onSettingsUpdate) {
          onSettingsUpdate({ editingItem: selectedItem });
        }
        break;
      case 'delete':
        if (confirm(`Are you sure you want to delete ${selectedItem.name || selectedItem.code || selectedItem.id}?`)) {
          toast({
            title: "Deleting...",
            description: "Item will be deleted",
            variant: "default"
          });
          // Trigger file operations for cleanup
          if (onFileUpload) {
            onFileUpload({ action: 'delete_backup', itemId: selectedItem.id });
          }
        }
        break;
    }
    handleMenuClose();
  };

  // Use platform pricing service instead of direct API calls
  // const { data: plansData, isLoading: plansLoading } = useQuery({
  //   queryKey: ['/api/admin/billing/plans'],
  //   queryFn: () => fetchWithAuth('/api/admin/billing/plans'),
  //   staleTime: 60000
  // });

  // Use platform pricing service data
  const plansData = { plans: subscriptionPlans };
  const plansLoading = pricingLoading;

  // Fetch invoices
  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['/api/admin/billing/invoices'],
    queryFn: () => fetchWithAuth('/api/admin/billing/invoices'),
    staleTime: 30000
});

  // Fetch coupons
  const { data: couponsData, isLoading: couponsLoading } = useQuery({
    queryKey: ['/api/admin/billing/coupons'],
    queryFn: () => fetchWithAuth('/api/admin/billing/coupons'),
    staleTime: 60000
});

  // Fetch split sheets for invoice generation (only for music producers)
  const { data: splitSheetsData } = useQuery({
    queryKey: ['split-sheets-for-invoice', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/split-sheets', {
        headers: {
          'Authorization': `Bearer ${user?.id || ','}`,
          'x-user-email': user?.email || ','
        }
      });
      if (!response.ok) throw new Error('Failed to fetch split sheets');
      return response.json();
    },
    enabled: isMusicProducer && splitSheetInvoiceDialogOpen,
  });

  // Generate invoice from split sheet mutation
  const generateInvoiceFromSplitSheetMutation = useMutation({
    mutationFn: async ({ splitSheetId, revenueId }: { splitSheetId: string; revenueId?: string }) => {
      // This would call a backend endpoint to generate invoice
      // For now, we'll create a placeholder invoice
      const response = await fetch('/api/admin/billing/invoices', {
        headers: {
          'Authorization': `Bearer ${user?.id || ','}`,
          'Content-Type': 'application/json',
          'x-user-email': user?.email || ','
        },
        method: 'POST',
        body: JSON.stringify({
          source: 'split_sheet',
          splitSheetId,
          revenueId,
        })
      });
      if (!response.ok) throw new Error('Failed to generate invoice');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/billing/invoices'] });
      setSplitSheetInvoiceDialogOpen(false);
      setSelectedSplitSheet(null);
      toast({
        title: "Faktura generert",
        description: "Faktura er generert fra split sheet",
        variant: "default"
      });
    },
    onError: () => {
      toast({
        title: "Feil ved generering",
        description: "Kunne ikke generere faktura",
        variant: "destructive"
      });
    }
  });

  // Create plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async (planData: Omit<BillingPlan, 'id' | 'active' | 'createdAt'>) => {
      const response = await fetch('/api/admin/billing/plans', {
        headers: {
          'Authorization': `Bearer ${user?.id || ','}`,
          'Content-Type': 'application/json',
          'x-user-email': user?.email || ','
        },
        method: 'POST',
        body: JSON.stringify(planData)
      });
      if (!response.ok) throw new Error('Failed to create plan');
      return response.json();
  },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/billing/plans'] });
      setPlanDialogOpen(false);
      handlePlanCreated(data);
      toast({
        title: "Plan opprettet",
        description: "Ny abonnementsplan er opprettet",
        variant: "default"
  });
  },
    onError: () => {
      toast({
        title: "Feil ved opprettelse",
        description: "Kunne ikke opprette plan",
        variant: "destructive"
  });
  }
});

  // Create coupon mutation
  const createCouponMutation = useMutation({
    mutationFn: async (couponData: Omit<Coupon, 'id' | 'timesRedeemed' | 'active' | 'createdAt'>) => {
      const response = await fetch('/api/admin/billing/coupons', {
        headers: {
          'Authorization': `Bearer ${user?.id || ','}`,
          'Content-Type': 'application/json',
          'x-user-email': user?.email || ','
        },
        method: 'POST',
        body: JSON.stringify(couponData)
      });
      if (!response.ok) throw new Error('Failed to create coupon');
      return response.json();
  },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/billing/coupons'] });
      setCouponDialogOpen(false);
      handleCouponCreated(data);
      toast({
        title: "Kupong opprettet",
        description: "Ny rabattkupong er opprettet",
        variant: "default"
  });
  },
    onError: () => {
      toast({
        title: "Feil ved opprettelse",
        description: "Kunne ikke opprette kupong",
        variant: "destructive"
  });
  }
});

  // Use platform pricing service formatting
  // const formatPrice = (price: number, currency: string) => {
  //   return new Intl.NumberFormat('nb-NO', {
  //     style: 'currency',
  //     currency,
  //     minimumFractionDigits: 0
  // }).format(price / 100);
  // };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'success';
      case 'overdue': return 'error';
      case 'pending': return 'warning';
      default: return 'default';
}
};

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid': return 'Betalt';
      case 'overdue': return 'Forfalt';
      case 'pending': return 'Venter';
      default: return status;
}
};

  const CreatePlanDialog = () => {
    // Static profession list with adapter configs
    const availableProfessions = [
      { id: 'photographer', name: 'Fotograf', config: allConfigs?.photographer },
      { id: 'videographer', name: 'Videograf', config: allConfigs?.videographer },
      { id: 'music_producer', name: 'Musikkprodusent', config: allConfigs?.music_producer }
    ];

    const [formData, setFormData] = useState({
      name: '',
      profession: 'photographer',
      price: '',
      features: '',
      maxUsers: '1',
      maxProjects: '100',
      storageLimit: '50'
  });

    const handleSubmit = () => {
      // Validate required fields
      if (!formData.name || !formData.profession || !formData.price) {
        toast({
          title: "Manglende felter",
          description: "Navn, profesjon og pris er påkrevd",
          variant: "destructive"
    });
        return;
    }

      createPlanMutation.mutate({
        ...formData,
        price: parseInt(formData.price) * 100, // Convert to øre
        features: formData.features.split('').map((f: string) => f.trim()).filter((f: string) => f),
        maxUsers: parseInt(formData.maxUsers),
        maxProjects: parseInt(formData.maxProjects),
        storageLimit: parseInt(formData.storageLimit),
        currency: 'NOK',
        interval: 'month'
    });
  };

    return (
      <Dialog open={planDialogOpen} onClose={() => setPlanDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <MoneyIcon sx={{ color: '#ff8c00'}} />
            Opprett ny abonnementsplan
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Plannavn"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Profesjon</InputLabel>
                <Select
                  value={formData.profession}
                  onChange={(e) => setFormData(prev => ({ ...prev, profession: e.target.value }))}
                  label="Profesjon"
                >
                  {availableProfessions.map(prof => (
                    <MenuItem key={prof.id} value={prof.id}>
                      {prof.config?.displayName || prof.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Pris per måned"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                type="number"
                InputProps={{
                  endAdornment: <InputAdornment position="end">NOK</InputAdornment>
            }}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Funksjoner (komma-separert)"
                value={formData.features}
                onChange={(e) => setFormData(prev => ({ ...prev, features: e.target.value }))}
                multiline
                rows={2}
                placeholder="Ubegrensede prosjekter, 50GB lagring, E-post support"
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Maks brukere"
                value={formData.maxUsers}
                onChange={(e) => setFormData(prev => ({ ...prev, maxUsers: e.target.value }))}
                type="number"
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Maks prosjekter"
                value={formData.maxProjects}
                onChange={(e) => setFormData(prev => ({ ...prev, maxProjects: e.target.value }))}
                type="number"
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Lagring (GB)"
                value={formData.storageLimit}
                onChange={(e) => setFormData(prev => ({ ...prev, storageLimit: e.target.value }))}
                type="number"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPlanDialogOpen(false)}>Avbryt</Button>
          <Button onClick={handleSubmit}
            variant="contained"
            disabled={createPlanMutation.isPending}
            sx={theming.getThemedButtonSx()}>
            {createPlanMutation.isPending ? 'Oppretter...' : 'Opprett plan'}
          </Button>
        </DialogActions>
      </Dialog>
    );
};

  const CreateCouponDialog = () => {
    const [formData, setFormData] = useState({
      code: ', ',
      name: ', ',
      discountType: 'percentage',
      discountValue: ', ',
      maxRedemptions: '100',
      expiresAt: ', '
  });

    const handleSubmit = () => {
      if (!formData.code || !formData.name || !formData.discountValue) {
        toast({
          title: "Manglende felter", 
          description: "Kodenavn og rabattverdi er påkrevd",
          variant: "destructive"
    });
        return;
    }

      createCouponMutation.mutate({
        ...formData,
        discountValue: formData.discountType === 'percentage' 
          ? parseInt(formData.discountValue)
          : parseInt(formData.discountValue) * 100, // Convert to øre for fixed amounts
        maxRedemptions: parseInt(formData.maxRedemptions),
        currency: 'NOK'
  });
  };

    return (
      <Dialog open={couponDialogOpen} onClose={() => setCouponDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <CouponIcon sx={{ color: '#ff8c00'}} />
            Opprett ny rabattkupong
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Kupongkode"
                value={formData.code}
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                required
                placeholder="SUMMER2024"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Kupong navn"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                placeholder="Sommer kampanje"
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Rabatt type</InputLabel>
                <Select
                  value={formData.discountType}
                  onChange={(e) => setFormData(prev => ({ ...prev, discountType: e.target.value }))}
                  label="Rabatt type"
                >
                  <MenuItem value="percentage">Prosent</MenuItem>
                  <MenuItem value="fixed">Fast beløp</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Rabatt verdi"
                value={formData.discountValue}
                onChange={(e) => setFormData(prev => ({ ...prev, discountValue: e.target.value }))}
                type="number"
                InputProps={{
                  endAdornment: <InputAdornment position="end">
                    {formData.discountType === 'percentage' ? '%' : 'NOK'}
                  </InputAdornment>
              }}
                required
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Maks innløsninger"
                value={formData.maxRedemptions}
                onChange={(e) => setFormData(prev => ({ ...prev, maxRedemptions: e.target.value }))}
                type="number"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Utløpsdato"
                value={formData.expiresAt}
                onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                type="date"
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCouponDialogOpen(false)}>Avbryt</Button>
          <Button onClick={handleSubmit}
            variant="contained"
            disabled={createCouponMutation.isPending}
            sx={theming.getThemedButtonSx()}>
            {createCouponMutation.isPending ? 'Oppretter...' : 'Opprett kupong'}
          </Button>
        </DialogActions>
      </Dialog>
    );
};

  // Split Sheet Invoice Generation Dialog
  const SplitSheetInvoiceDialog = () => {
    const splitSheets = splitSheetsData?.data || [];

    return (
      <Dialog open={splitSheetInvoiceDialogOpen} onClose={() => setSplitSheetInvoiceDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <SplitSheetIcon sx={{ color: '#9f7aea' }} />
            Generer faktura fra Split Sheet
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Velg en split sheet for å generere en faktura basert på inntektsdata.
          </Alert>
          {splitSheets.length === 0 ? (
            <Typography color="text.secondary">Ingen split sheets funnet.</Typography>
          ) : (
            <List>
              {splitSheets.map((splitSheet: any) => (
                <ListItemButton
                  key={splitSheet.id}
                  selected={selectedSplitSheet?.id === splitSheet.id}
                  onClick={() => setSelectedSplitSheet(splitSheet)}
                >
                  <ListItemText
                    primary={splitSheet.title}
                    secondary={`Status: ${splitSheet.status} • ${splitSheet.contributor_count || 0} bidragsytere`}
                  />
                  {splitSheet.total_revenue && (
                    <Chip
                      label={`${splitSheet.total_revenue.toLocaleString('nb-NO')} kr`}
                      color="primary"
                      size="small"
                    />
                  )}
                </ListItemButton>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSplitSheetInvoiceDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (selectedSplitSheet) {
                generateInvoiceFromSplitSheetMutation.mutate({
                  splitSheetId: selectedSplitSheet.id
                });
              }
            }}
            disabled={!selectedSplitSheet || generateInvoiceFromSplitSheetMutation.isPending}
            sx={{ bgcolor: '#9f7aea', '&:hover': { bgcolor: '#8e6fd9' } }}
          >
            {generateInvoiceFromSplitSheetMutation.isPending ? 'Genererer...' : 'Generer faktura'}
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <CreatePlanDialog />
      <CreateCouponDialog />
      {isMusicProducer && <SplitSheetInvoiceDialog />}

      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" sx={{ color: theming.colors.primary, fontWeight: 600}}>
          💰 Økonomi & Fakturering
        </Typography>
      </Box>

      {/* Quick Settings Panel */}
      <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper', ...theming.getThemedCardSx() }}>
        <Typography variant="subtitle2" gutterBottom sx={{ mb: 1 }}>
          Quick Settings & Filters
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControlLabel
            control={
              <Switch 
                defaultChecked 
                onChange={(e) => {
                  if (onSettingsUpdate) {
                    onSettingsUpdate({ autoRefresh: e.target.checked });
                  }
                }}
              />
            }
            label="Auto-refresh data"
          />
          <FormControlLabel
            control={
              <Switch 
                onChange={(e) => {
                  if (onFileUpload && e.target.checked) {
                    onFileUpload({ action: 'enable_auto_backup', source: 'billing' });
                  }
                }}
              />
            }
            label="Auto-backup billing data"
          />
          <FormControlLabel
            control={
              <Switch 
                defaultChecked={features && features.length > 0}
                onChange={(e) => {
                  console.log('Platform features toggle:', e.target.checked, features);
                }}
              />
            }
            label="Show platform features"
          />
        </Box>\n      </Paper>

      {/* Navigation Tabs */}
      <Card sx={theming.getThemedCardSx()}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            '& .MuiTabs-indicator': { backgroundColor: '#ff8c00',}
        }}
        >
          <Tab icon={<MoneyIcon />} label="Planer" />
          <Tab icon={<InvoiceIcon />} label="Fakturaer" />
          <Tab icon={<CouponIcon />} label="Kuponger" />
          <Tab icon={<ReportsIcon />} label="Rapporter" />
          <Tab icon={<TrendingUp />} label="Price Management" />
          <Tab icon={<AnalyticsIcon />} label="Analytics" />
          <Tab icon={<RefundIcon />} label="Refunderinger" />
          <Tab icon={<PauseIcon />} label="Pause Abonnement" />
          <Tab icon={<PaymentIcon />} label="Betalingsmetoder" />
        </Tabs>
      </Card>

      {/* Plans Tab */}
      <TabPanel value={tabValue} index={0}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>Abonnementsplaner</Typography>
          <Button variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setPlanDialogOpen(true)}
            sx={{ bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67e00' } }}
          >
            Ny plan
          </Button>
        </Box>

        <Grid container spacing={3}>
          {plansLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent>
                    <Skeleton variant="text" height={40} />
                    <Skeleton variant="text" height={20} />
                    <Skeleton variant="rectangular" height={100} />
                  </CardContent>
                </Card>
              </Grid>
            ))
          ) : (
            plansData?.plans?.map((plan: any) => (
              <Grid item xs={12} md={4} key={plan.id}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getProfessionIcon(plan.profession)}
                        <Box>
                          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                            {plan.name}
                          </Typography>
                          <Chip label={plan.profession} size="small" color="primary" />
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Tooltip title={plan.active ? 'Active plan' : 'Inactive plan'}>
                          <Chip 
                            label={plan.active ? 'Aktiv' : 'Inaktiv'}
                            color={plan.active ? 'success' : 'default'}
                            size="small"
                            icon={plan.active ? <CheckCircle /> : <Cancel />}
                          />
                        </Tooltip>
                        <Tooltip title="Actions">
                          <IconButton 
                            size="small"
                            onClick={(e) => handleMenuOpen(e, plan)}
                          >
                            <MoreVertIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                    
                    <Typography variant="h4" sx={{ color: theming.colors.primary, fontWeight: 600, mb: 1 }}>
                      {formatPrice(plan.price, plan.currency as any)}
                      <Typography component="span" variant="body2" color="text.secondary">
                        /mnd
                      </Typography>
                    </Typography>
                    
                    <List dense>
                      {plan.features.slice(0, 4).map((feature: string, index: number) => (
                        <ListItem key={index} sx={{ px: 0, py: 0.5 }}>
                          <ListItemText 
                            primary={feature}
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                    
                    <Divider sx={{ my: 2 }} />
                    
                    <Grid container spacing={2} sx={{ textAlign: 'center' }}>
                      <Grid item xs={4}>
                        <Typography variant="caption" color="text.secondary">Brukere</Typography>
                        <Typography variant="body2" fontWeight={600}>{plan.maxUsers}</Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="caption" color="text.secondary">Prosjekter</Typography>
                        <Typography variant="body2" fontWeight={600}>{plan.maxProjects}</Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="caption" color="text.secondary">Lagring</Typography>
                        <Typography variant="body2" fontWeight={600}>{plan.storageLimit}GB</Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      </TabPanel>

      {/* Invoices Tab */}
      <TabPanel value={tabValue} index={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>Fakturaer</Typography>
          {isMusicProducer && (
            <Button
              variant="outlined"
              startIcon={<SplitSheetIcon />}
              onClick={() => setSplitSheetInvoiceDialogOpen(true)}
              sx={{
                borderColor: '#9f7aea',
                color: '#9f7aea', '&:hover': {
                  borderColor: '#9f7aea',
                  bgcolor: '#9f7aea10'
                }
              }}
            >
              Generer fra Split Sheet
            </Button>
          )}
        </Box>
        
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={{ p: 0 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Faktura ID</TableCell>
                    <TableCell>Kunde</TableCell>
                    <TableCell>Plan</TableCell>
                    <TableCell align="right">Beløp</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">Opprettet</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoicesLoading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <TableRow key={index}>
                        {Array.from({ length: 6 }).map((_, cellIndex) => (
                          <TableCell key={cellIndex}>
                            <Skeleton variant="text" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    invoicesData?.invoices?.map((invoice: Invoice) => (
                      <TableRow key={invoice.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {invoice.id}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight={500}>
                              {invoice.customerName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {invoice.customerEmail}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{invoice.planId}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={600}>
                            {formatPrice(invoice.amount, invoice.currency as any)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
                            {invoice.status === 'pending' && <Pending fontSize="small" color="warning" />}
                            {invoice.status === 'paid' && <CheckCircle fontSize="small" color="success" />}
                            {invoice.status === 'overdue' && <Cancel fontSize="small" color="error" />}
                            <Chip 
                              label={getStatusLabel(invoice.status)}
                              color={getStatusColor(invoice.status) as 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                              size="small"
                            />
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="caption" color="text.secondary">
                            {new Date(invoice.createdAt).toLocaleDateString('nb-NO')}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Coupons Tab */}
      <TabPanel value={tabValue} index={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>Rabattkuponger</Typography>
          <Button variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCouponDialogOpen(true)}
            sx={{ bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67e00' } }}
          >
            Ny kupong
          </Button>
        </Box>

        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={{ p: 0 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Kupongkode</TableCell>
                    <TableCell>Navn</TableCell>
                    <TableCell>Rabatt</TableCell>
                    <TableCell align="center">Innløsninger</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">Utløper</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {couponsLoading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                      <TableRow key={index}>
                        {Array.from({ length: 6 }).map((_, cellIndex) => (
                          <TableCell key={cellIndex}>
                            <Skeleton variant="text" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    couponsData?.coupons?.map((coupon: Coupon) => (
                      <TableRow key={coupon.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600} fontFamily="monospace">
                            {coupon.code}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{coupon.name}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="#ff8c00" fontWeight={600}>
                            {coupon.discountType === 'percentage' 
                              ? `${coupon.discountValue}%`
                              : formatPrice(coupon.discountValue, coupon.currency as any)
                          }
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2">
                            {coupon.timesRedeemed} / {coupon.maxRedemptions}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip 
                            label={coupon.active ? 'Aktiv' : 'Inaktiv'}
                            color={coupon.active ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="caption" color="text.secondary">
                            {new Date(coupon.expiresAt).toLocaleDateString('nb-NO')}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Reports Tab */}
      <TabPanel value={tabValue} index={3}>
        <ReportsPanel />
      </TabPanel>

      {/* Price Management Tab */}
      <TabPanel value={tabValue} index={4}>
        <PriceManagementDashboard />
      </TabPanel>

      {/* Analytics Tab */}
      <TabPanel value={tabValue} index={5}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AnalyticsIcon />
              Abonnement & Refundering Analytics
            </Typography>
            <Divider sx={{ my: 2 }} />
            <BillingAnalytics />
          </CardContent>
        </Card>
      </TabPanel>

      {/* Refund Requests Tab */}
      <TabPanel value={tabValue} index={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <RefundIcon />
              Refunderingsforespørsler
            </Typography>
            <Divider sx={{ my: 2 }} />
            <RefundRequestsTable />
          </CardContent>
        </Card>
      </TabPanel>

      {/* Subscription Pause Tab */}
      <TabPanel value={tabValue} index={7}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PauseIcon />
              Pause Abonnement
            </Typography>
            <Divider sx={{ my: 2 }} />

            <Alert severity="info" sx={{ mb: 3 }}>
              Her kan du pause brukerabonnementer midlertidig uten å kansellere dem.
            </Alert>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Bruker</TableCell>
                    <TableCell>Plan</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Pausert til</TableCell>
                    <TableCell align="center">Handlinger</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Alert severity="info" sx={{ mt: 2 }}>
                        Ingen pausede abonnementer for øyeblikket.
                      </Alert>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Payment Methods Tab */}
      <TabPanel value={tabValue} index={8}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems:'center', gap: 1 }}>
              <PaymentIcon />
              Betalingsmetoder
            </Typography>
            <Divider sx={{ my: 2 }} />
            <PaymentMethodsTable />
          </CardContent>
        </Card>
      </TabPanel>

      {/* Action Menu for all items */}
      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => handleMenuAction('view')}>
          <ListItemIcon><ViewIcon fontSize="small" /></ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction('edit')}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => handleMenuAction('delete')} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
}