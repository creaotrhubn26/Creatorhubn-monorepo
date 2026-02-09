/**
 * CreatorHub Norge - Comprehensive Pricing Management Interface
 * Integrated across all platform areas
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from "@/integration/EnhancedMasterIntegrationProvider";
import { useTheming } from '../../utils/theming-helper';
import { useClientServicePricing } from '../../services/ClientServicePricingService';
import { apiRequest } from '@/lib/queryClient';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Chip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Fab,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Category as CategoryIcon,
  LocalOffer as PriceIcon,
  Group as CustomerIcon,
  Inventory as PackageIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';

// Import dynamic profession system
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import PriceAdministration from '../PriceAdministration';

interface PricingManagementProps {
  userId: string;
  profession: string;
  onPricingUpdate?: () => void
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 4 }}>{children}</Box>}
    </div>
  );
}

export default function PricingManagement({ userId, profession, onPricingUpdate }: PricingManagementProps) {
  // Use dynamic profession system
  const { professionConfigs, isLoading: professionsLoading } = useDynamicProfessions();
  const professionConfig = professionConfigs?.[profession];

  // Client service pricing service integration
  const { 
    formatCurrency,
    getDefaultPrice,
    getMVA,
    getTotalWithMVA,
    isLoading: pricingLoading 
} = useClientServicePricing();
  const [tabValue, setTabValue] = useState(0);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [serviceDialog, setServiceDialog] = useState(false);
  const [packageDialog, setPackageDialog] = useState(false);
  const [customerPricingDialog, setCustomerPricingDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
    const [alert, setAlert] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);
  const [confirmDeletePricingId, setConfirmDeletePricingId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Master integration system for "everything interacts with everything"
  const { integration, communication, dataFlow, componentRegistry, features } = useEnhancedMasterIntegration();
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession);
  
  // Get profession icon and color (after theming is initialized)
  const professionIcon = getProfessionIcon(profession);
  const professionColor = theming.colors.primary;

  // Comprehensive Feature System for Pricing Management
  const pricingManagementAccess = features.checkFeatureAccess('pricing-management,');
  const priceAdministrationAccess = features.checkFeatureAccess('price-administration,');
  const packageManagementAccess = features.checkFeatureAccess('package-management');
  const subscriptionManagementAccess = features.checkFeatureAccess('subscription-management');
  const billingAccess = features.checkFeatureAccess('billing');
  const pricingAnalyticsAccess = features.checkFeatureAccess('pricing-analytics');
  const discountManagementAccess = features.checkFeatureAccess('discount-management');
  const revenueTrackingAccess = features.checkFeatureAccess('revenue-tracking');

  // Register component and data flow nodes with MasterIntegrationProvider
  useEffect(() => {
    communication.registerComponent('pricing-management', 'pricing', [
      'data:read', 'data:write', 'event:emit', 'event:listen', 'ui:update', 'pricing:create', 'pricing:update', 'pricing:delete', 'category:manage', 'service:manage', 'package:manage', 'customer:manage'
    ]);

    // Track feature usage
    features.trackFeatureUsage('pricing-management', 'opened', {
      timestamp: Date.now(),
      component: 'PricingManagement',
      activeTab: tabValue
});

    dataFlow.registerNode({
      type: 'source',
      componentId: 'pricing-management',
      dataKey: 'pricing-management:categories',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now(),})
  });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'pricing-management',
      dataKey: 'pricing-management:services',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now(),})
  });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'pricing-management',
      dataKey: 'pricing-management:packages',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now(),})
  });

    return () => {
      communication.unregisterComponent('pricing-management');
  };
}, [communication, dataFlow]);

  // Listen to global events from other components
  useEffect(() => {
    const unsubscribe = communication.onMessage((message: any) => {
      if (message.type === 'project:selected' && message.data) {
        console.log('💰 Pricing Management: Project selected', message.data);
        // Update pricing context based on selected project
    }
      if (message.type === 'client:selected' && message.data) {
        console.log('💰 Pricing Management: Client selected', message.data);
        // Update pricing context based on selected client
    }
      if (message.type === 'data:sync' && message.data.dataKey === 'pricing-management:categories') {
        console.log('💰 Pricing Management: Categories synced', message.data.data);
    }
  });
    return unsubscribe;
}, [communication]);

  // Fetch pricing data
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['/api/pricing/categories', userId],
    queryFn: () => apiRequest(`/api/pricing/categories/${userId}`)
});

  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ['/api/pricing/services', userId],
    queryFn: () => apiRequest(`/api/pricing/services/${userId}`)
});

  const { data: packages = [], isLoading: packagesLoading } = useQuery({
    queryKey: ['/api/pricing/packages', userId],
    queryFn: () => apiRequest(`/api/pricing/packages/${userId}`)
});

  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['/api/clients', userId],
    queryFn: () => apiRequest(`/api/clients?userId=${userId}`)
  });

  const { data: customerPricing = [], isLoading: customerPricingLoading } = useQuery({
    queryKey: ['/api/pricing/customer-pricing', userId],
    queryFn: () => apiRequest(`/api/pricing/customer-pricing/${userId}`)
  });

  // Mutations for CRUD operations
  const createCategoryMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/pricing/categories', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POST',
        body: JSON.stringify({ ...data, userId, profession })
    });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/categories', ],});
      setCategoryDialog(false);
      setAlert({ severity: 'success', message: 'Kategori opprettet!',});
      onPricingUpdate?.();
  },
    onError: () => {
      setAlert({ severity: 'error', message: 'Feil ved opprettelse av kategori',});
  }
});

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest(`/api/pricing/categories/${id}`, {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'PUT',
        body: JSON.stringify(data)
  });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/categories', ],});
      setCategoryDialog(false);
      setAlert({ severity: 'success', message: 'Kategori oppdatert!',});
      onPricingUpdate?.();
  }
});

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/pricing/categories/${id}`, {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'DELETE'
  });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/categories', ],});
      setAlert({ severity: 'success', message: 'Kategori slettet!',});
      onPricingUpdate?.();
  }
});

  const createServiceMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/pricing/services', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POST',
        body: JSON.stringify({ ...data, userId })
    });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/services', ],});
      setServiceDialog(false);
      setAlert({ severity: 'success', message: 'Tjeneste opprettet!',});
      onPricingUpdate?.();
  }
});

  const updateServiceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest(`/api/pricing/services/${id}`, {
        method: 'PUT',
        headers: {
          "Content-Type" : "application/json"
        },
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/services'] });
      setServiceDialog(false);
      setAlert({ severity: 'success', message: 'Tjeneste oppdatert!' });
      onPricingUpdate?.();
    }
  });

  // Package mutations
  const createPackageMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/pricing/packages', {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, userId, profession })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/packages', userId] });
      setPackageDialog(false);
      setAlert({ severity: 'success', message: 'Pakke opprettet!' });
      onPricingUpdate?.();
    },
    onError: () => {
      setAlert({ severity: 'error', message: 'Feil ved opprettelse av pakke' });
    }
  });

  const updatePackageMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest(`/api/pricing/packages/${id}`, {
        method: 'PUT',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/packages'] });
      setPackageDialog(false);
      setAlert({ severity: 'success', message: 'Pakke oppdatert!' });
      onPricingUpdate?.();
    }
  });

  const deletePackageMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/pricing/packages/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/packages'] });
      setAlert({ severity: 'success', message: 'Pakke slettet!' });
    }
  });

  // Customer pricing mutations
  const createCustomerPricingMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/pricing/customer-pricing', {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, userId, profession })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/customer-pricing', userId] });
      setCustomerPricingDialog(false);
      setAlert({ severity: 'success', message: 'Kundepris opprettet!' });
      onPricingUpdate?.();
    },
    onError: () => {
      setAlert({ severity: 'error', message: 'Feil ved opprettelse av kundepris' });
    }
  });

  const updateCustomerPricingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest(`/api/pricing/customer-pricing/${id}`, {
        method: 'PUT',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/customer-pricing'] });
      setCustomerPricingDialog(false);
      setAlert({ severity: 'success', message: 'Kundepris oppdatert!' });
      onPricingUpdate?.();
    }
  });

  const deleteCustomerPricingMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/pricing/customer-pricing/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/customer-pricing'] });
      setAlert({ severity: 'success', message: 'Kundepris slettet!' });
    }
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/pricing/services/${id}`, {
        method: 'DELETE',
        headers: {
          "Content-Type" : "application/json"
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/services'] });
      setAlert({ severity: 'success', message: 'Tjeneste slettet!' });
      onPricingUpdate?.();
    }
  });

  // Sync pricing data on component mount and data changes
  useEffect(() => {
    dataFlow.syncData('pricing-management: categories', categories);
    dataFlow.syncData('pricing-management: services', services);
    dataFlow.syncData('pricing-management: packages', packages);
}, [dataFlow, categories, services, packages]);

  // Handle tab changes and broadcast them
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    
    // Broadcast tab change to other components
    communication.sendMessage({
      from: 'pricing-management',
      to: 'all',
      type: 'pricing:tabChanged',
      data: {
        tabValue: newValue,
        tabName: ['Kategorier','Tjenester','Pakker','Kundepriser','Avansert'][newValue] || 'Unknown',
        timestamp: Date.now()
      }
    });
  };

  // Enhanced mutation handlers with integration broadcasting
  const handleCategoryCreated = (categoryData: any) => {
    console.log('💰 Category Created: ', categoryData);
    
    // Broadcast to other components
    communication.sendMessage({
      from: 'pricing-management',
      to: 'all',
      type: 'pricing:categoryCreated',
      data: {
        ...categoryData,
        createdBy: 'pricing-management',
        timestamp: Date.now()
  }
  });

    // Sync data flow
    dataFlow.syncData('pricing-management: categories', [...categories, categoryData]);
};

  const handleServiceCreated = (serviceData: any) => {
    console.log('💰 Service Created, :', serviceData);
    
    // Broadcast to other components
    communication.sendMessage({
      from: 'pricing-management',
      to: 'all',
      type: 'pricing:serviceCreated',
      data: {
        ...serviceData,
        createdBy: 'pricing-management',
        timestamp: Date.now()
  }
  });

    // Sync data flow
    dataFlow.syncData('pricing-management: services', [...services, serviceData]);
};

  const handlePackageCreated = (packageData: any) => {
    console.log('💰 Package Created, :', packageData);
    
    // Broadcast to other components
    communication.sendMessage({
      from: 'pricing-management',
      to: 'all',
      type: 'pricing:packageCreated',
      data: {
        ...packageData,
        createdBy: 'pricing-management',
        timestamp: Date.now()
  }
  });

    // Sync data flow
    dataFlow.syncData('pricing-management: packages', [...packages, packageData]);
};

  // Categories Tab Content
  const CategoriesTab = () => (
    <Box>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 4,
        pb: 3,
        borderBottom: '1px solid',
        borderColor: 'divider'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              p: 1.25,
              borderRadius: 2,
              bgcolor: 'primary.50',
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <CategoryIcon sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ color: theming.colors.primary, fontWeight: 700 }}>
              {professionConfig?.displayName
                ? `${professionConfig.displayName} - Priskategorier`
                : 'Priskategorier'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              Organiser tjenester i kategorier
            </Typography>
          </Box>
        </Box>
        <Button variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setSelectedItem(null);
            setCategoryDialog(true);
        }}
          sx={{ 
            ...theming.getThemedButtonSx(),
            borderRadius: 2,
            px: 3,
            py: 1.25,
            fontWeight: 700,
            textTransform: 'none',
            boxShadow: 2,
            '&:hover': {
              boxShadow: 4
            }
      }}
        >
          Ny kategori
        </Button>
      </Box>

      <Grid container spacing={3}>
        {Array.isArray(categories) && categories.map((category: any) => (
          <Grid size={{ xs: 12, md: 6, lg: 4 }} key={category.id}>
            <Card sx={{
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(10px)',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2.5,
              transition: 'all 0.3s',
              '&:hover': {
                boxShadow: 4,
                transform: 'translateY(-2px)',
                borderColor: 'primary.main'
              },
              ...theming.getThemedCardSx()
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5 }}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary, fontWeight: 700, fontSize: '1.15rem' }}>
                    {category.category_name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSelectedItem(category);
                        setCategoryDialog(true);
                    }}
                      sx={{
                        '&:hover': {
                          bgcolor: 'primary.50',
                          color: 'primary.main'
                        }
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => deleteCategoryMutation.mutate(category.id)}
                      sx={{
                        '&:hover': {
                          bgcolor: 'error.50',
                          color: 'error.main'
                        }
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.6, minHeight: 40 }}>
                  {category.description || 'Ingen beskrivelse'}
                </Typography>
                <Chip
                  label={category.is_active ? 'Aktiv' : 'Inaktiv'}
                  color={category.is_active ? 'success' : 'default'}
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  // Services Tab Content
  const ServicesTab = () => (
    <Box>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 4,
        pb: 3,
        borderBottom: '1px solid',
        borderColor: 'divider'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              p: 1.25,
              borderRadius: 2,
              bgcolor: 'primary.50',
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <PriceIcon sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ color: theming.colors.primary, fontWeight: 700 }}>
              {professionConfig?.displayName
                ? `${professionConfig.displayName} - Tjenester og priser`
                : 'Tjenester og priser'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              Definer individuelle tjenester med priser
            </Typography>
          </Box>
        </Box>
        <Button variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setSelectedItem(null);
            setServiceDialog(true);
        }}
          sx={{ 
            ...theming.getThemedButtonSx(),
            borderRadius: 2,
            px: 3,
            py: 1.25,
            fontWeight: 700,
            textTransform: 'none',
            boxShadow: 2,
            '&:hover': {
              boxShadow: 4
            }
      }}
        >
          Ny tjeneste
        </Button>
      </Box>

      <TableContainer 
        component={Paper} 
        sx={{ 
          background: 'rgba(255, 255, 255, 0.98)',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2.5,
          overflow: 'hidden'
        }}
      >
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>Tjeneste</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>Kategori</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>Pris</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>Synlig</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>Handlinger</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.isArray(services) && services.map((service: any) => (
              <TableRow key={service.d}>
                <TableCell>
                  <Typography variant="subtitle2">{service.service_name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {service.description}
                  </Typography>
                </TableCell>
                <TableCell>{service.category_name}</TableCell>
                <TableCell>
                  <Typography variant="subtitle2" sx={{ color: '#ff6b35'}}>
                    {service.base_price} NOK
                  </Typography>
                  <Typography variant="caption">
                    per {service.unit}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip label={service.price_type} size="small" />
                </TableCell>
                <TableCell>
                  <IconButton size="small">
                    {service.is_visible ? <VisibilityIcon /> : <VisibilityOffIcon />}
                  </IconButton>
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setSelectedItem(service);
                      setServiceDialog(true);
                  }}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => deleteServiceMutation.mutate(service.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  // Packages Tab Content
  const PackagesTab = () => (
    <Box>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 4,
        pb: 3,
        borderBottom: '1px solid',
        borderColor: 'divider'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              p: 1.25,
              borderRadius: 2,
              bgcolor: 'primary.50',
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <PackageIcon sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ color: theming.colors.primary, fontWeight: 700 }}>
              {professionConfig?.displayName
                ? `${professionConfig.displayName} - Pakkepriser`
                : 'Pakkepriser'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              Kombiner tjenester i pakker
            </Typography>
          </Box>
        </Box>
        <Button variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setSelectedItem(null);
            setPackageDialog(true);
        }}
          sx={{ 
            ...theming.getThemedButtonSx(),
            borderRadius: 2,
            px: 3,
            py: 1.25,
            fontWeight: 700,
            textTransform: 'none',
            boxShadow: 2,
            '&:hover': {
              boxShadow: 4
            }
      }}
        >
          Ny pakke
        </Button>
      </Box>

      <Grid container spacing={3}>
        {Array.isArray(packages) && packages.map((pkg: any) => (
          <Grid size={{ xs: 12, md: 6, lg: 4 }} key={pkg.id}>
            <Card sx={{
              background: 'rgba(25, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(25, 107, 53, 0.2)',
              height: '100%',
              ...theming.getThemedCardSx()
            }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    {pkg.package_name}
                  </Typography>
                  <Box>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSelectedItem(pkg);
                        setPackageDialog(true);
                    }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => deletePackageMutation.mutate(pkg.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                  {pkg.description}
                </Typography>
                <Typography variant="h5" sx={{ mb: 2, color: theming.colors.primary }}>
                  {pkg.total_price} NOK
                </Typography>
                {pkg.discount_from_individual && (
                  <Chip
                    label={`Spar ${pkg.discount_from_individual} NOK`}
                    color="success"
                    size="small"
                    sx={{ mb:  2 }}
                  />
                )}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap'}}>
                  <Chip
                    label={pkg.is_active ? 'Aktiv' : 'Inaktiv'}
                    color={pkg.is_active ? 'success' : 'default'}
                    size="small"
                  />
                  <Chip
                    label={pkg.is_visible ? 'Synlig' : 'Skjult'}
                    color={pkg.is_visible ? 'primary' : 'default'}
                    size="small"
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      {alert && (
        <Alert 
          severity={alert.severity}
          onClose={() => setAlert(null)}
          sx={{ 
            mb: 4,
            borderRadius: 2,
            boxShadow: 1
          }}
        >
          {alert.message}
        </Alert>
      )}
      
      {/* Feature Analytics Display */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1.5, 
        mb: 4,
        p: 2,
        borderRadius: 2,
        bgcolor: 'grey.50',
        border: '1px solid',
        borderColor: 'divider'
      }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          Features: {features.getFeatureAnalytics().enabledFeatures}/{features.getFeatureAnalytics().totalFeatures}
        </Typography>
        <Chip 
          label={`${Math.round(features.getFeatureAnalytics().featureAdoptionRate * 100)}%`}
          size="small"
          color="primary"
          sx={{ fontWeight: 600 }}
        />
      </Box>

      <Card sx={{
        background: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(20px)',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        ...theming.getThemedCardSx()
      }}>
        <Box sx={{ 
          borderBottom: 1, 
          borderColor: 'divider',
          px: 2,
          pt: 2
        }}>
          <Tabs 
            value={tabValue}
            onChange={handleTabChange}
            sx={{
              '& .MuiTab-root': {
                color: 'text.secondary',
                fontWeight: 600,
                fontSize: '0.95rem',
                textTransform: 'none',
                minHeight: 56,
                px: 3,
                gap: 1.5,
                '&.Mui-selected': {
                  color: theming.colors.primary,
                  fontWeight: 700
                },
                '&:hover': {
                  bgcolor: 'action.hover',
                  borderRadius: '8px 8px 0 0'
                }
              },
              '& .MuiTabs-indicator': {
                height: 3,
                borderRadius: '3px 3px 0 0',
                backgroundColor: theming.colors.primary
              }
            }}
          >
            <Tab icon={<CategoryIcon />} iconPosition="start" label="Kategorier" />
            <Tab icon={<PriceIcon />} iconPosition="start" label="Tjenester" />
            <Tab icon={<PackageIcon />} iconPosition="start" label="Pakker" />
            <Tab icon={<CustomerIcon />} iconPosition="start" label="Kundepriser" />
            <Tab icon={<SettingsIcon />} iconPosition="start" label="Avansert" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <CategoriesTab />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <ServicesTab />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <PackagesTab />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {professionIcon && (
              <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
                {professionIcon}
              </Box>
            )}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              {professionConfig?.displayName
                ? `${professionConfig.displayName} - Kundepriser`
                : 'Kundepriser'}
            </Typography>
          </Box>
          <Typography color="text.secondary">
            Administrer spesialpriser og rabatter for {professionConfig ? professionConfig.displayName.toLowerCase() : ''} kunder
          </Typography>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Kundepriser</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setSelectedItem(null);
                setCustomerPricingDialog(true);
              }}
              sx={{
                background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
                color: 'white'
              }}
            >
              Ny kundepris
            </Button>
          </Box>

          <Box sx={{ mt: 3 }}>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Kunde</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Tjeneste/Pakke</TableCell>
                    <TableCell>Rabatt</TableCell>
                    <TableCell>Gyldig til</TableCell>
                    <TableCell>Handlinger</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Array.isArray(customerPricing) && customerPricing.length > 0 ? (
                    customerPricing.map((pricing: any) => (
                      <TableRow key={pricing.id}>
                        <TableCell>
                          {clients.find((c: any) => c.id === pricing.client_id)?.name || 'Ukjent kunde'}
                        </TableCell>
                        <TableCell>{pricing.pricing_type === 'service' ? 'Tjeneste' : 'Pakke'}</TableCell>
                        <TableCell>{pricing.item_name}</TableCell>
                        <TableCell>{pricing.discount_percentage}%</TableCell>
                        <TableCell>{pricing.valid_until ? new Date(pricing.valid_until).toLocaleDateString('nb-NO') : 'Ingen grense'}</TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedItem(pricing);
                              setCustomerPricingDialog(true);
                            }}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setConfirmDeletePricingId(pricing.id);
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography variant="body2" color="text.secondary">
                          Ingen kundepriser ennå. Klikk "Ny kundepris" for å komme i gang.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <PriceAdministration profession={profession} userId={userId} />
        </TabPanel>
      </Card>

      {/* Category Dialog */}
      <Dialog open={categoryDialog} onClose={() => setCategoryDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedItem ? 'Rediger kategori' : 'Ny kategori'}
        </DialogTitle>
        <DialogContent>
          <CategoryForm
            category={selectedItem}
            onSave={(data) => {
              if (selectedItem) {
                updateCategoryMutation.mutate({ id: selectedItem.id, data });
              } else {
                createCategoryMutation.mutate(data);
              }
            }}
            onCancel={() => setCategoryDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Service Dialog */}
      <Dialog open={serviceDialog} onClose={() => setServiceDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedItem ? 'Rediger tjeneste' : 'Ny tjeneste'}
        </DialogTitle>
        <DialogContent>
          <ServiceForm
            service={selectedItem}
            categories={categories}
            onSave={(data) => {
              if (selectedItem) {
                updateServiceMutation.mutate({ id: selectedItem.id, data });
              } else {
                createServiceMutation.mutate(data);
              }
            }}
            onCancel={() => setServiceDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Package Dialog */}
      <Dialog open={packageDialog} onClose={() => setPackageDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedItem ? 'Rediger pakke' : 'Ny pakke'}
        </DialogTitle>
        <DialogContent>
          <PackageForm
            package={selectedItem}
            services={services}
            onSave={(data) => {
              if (selectedItem) {
                updatePackageMutation.mutate({ id: selectedItem.id, data });
              } else {
                createPackageMutation.mutate(data);
              }
              setCategoryDialog(false);
            }}
            onCancel={() => setPackageDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Customer Pricing Dialog */}
      <Dialog open={customerPricingDialog} onClose={() => setCustomerPricingDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedItem ? 'Rediger kundepris' : 'Ny kundepris'}
        </DialogTitle>
        <DialogContent>
          <CustomerPricingForm
            customerPricing={selectedItem}
            clients={clients}
            services={services}
            packages={packages}
            onSave={(data) => {
              if (selectedItem) {
                updateCustomerPricingMutation.mutate({ id: selectedItem.id, data });
              } else {
                createCustomerPricingMutation.mutate(data);
              }
            }}
            onCancel={() => setCustomerPricingDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Customer Pricing Dialog */}
      <Dialog open={!!confirmDeletePricingId} onClose={() => setConfirmDeletePricingId(null)}>
        <DialogTitle>Bekreft sletting</DialogTitle>
        <DialogContent>
          <Typography>Er du sikker på at du vil slette denne kundeprisen? Denne handlingen kan ikke angres.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeletePricingId(null)}>Avbryt</Button>
          <Button 
            onClick={() => {
              if (confirmDeletePricingId) {
                deleteCustomerPricingMutation.mutate(confirmDeletePricingId);
                setConfirmDeletePricingId(null);
              }
            }} 
            color="error" 
            variant="contained"
          >
            Slett
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

// Category Form Component
function CategoryForm({ category, onSave, onCancel }: any) {
  const [formData, setFormData] = useState({
    categoryName: category?.category_name ||', ',
    description: category?.description ||', ',
    isActive: category?.is_active ?? true
});

  return (
    <Box sx={{ pt:  2 }}>
      <TextField
        fullWidth
        label="Kategorinavn"
        value={formData.categoryName}
        onChange={(e) => setFormData({ ...formData, categoryName: e.target.value })}
        sx={{ mb:  3 }}
      />
      <TextField
        fullWidth
        multiline
        rows={3}
        label="Beskrivelse"
        value={formData.description}
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        sx={{ mb:  3 }}
      />
      <FormControlLabel
        control={
          <Switch
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
          />
      }
        label="Aktiv kategori"
        sx={{ mb:  3 }}
      />
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button onClick={onCancel}>Avbryt</Button>
        <Button
          variant="contained"
          onClick={() => onSave(formData)}
          sx={{
            background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
            color: 'white'
          }}
        >
          Lagre
        </Button>
      </Box>
    </Box>
  );
}

// Package Form Component
function PackageForm({ package: pkg, services, onSave, onCancel }: any) {
  const [formData, setFormData] = useState({
    packageName: pkg?.package_name || '',
    description: pkg?.description || '',
    basePrice: pkg?.base_price || '',
    discountPercentage: pkg?.discount_percentage || 0,
    includedServices: pkg?.included_services || [],
    isActive: pkg?.is_active ?? true,
    isVisible: pkg?.is_visible ?? true
  });

  return (
    <Box sx={{ pt: 2 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Pakkenavn"
            value={formData.packageName}
            onChange={(e) => setFormData({ ...formData, packageName: e.target.value })}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Beskrivelse"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            type="number"
            label="Grunnpris (NOK)"
            value={formData.basePrice}
            onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            type="number"
            label="Rabatt (%)"
            value={formData.discountPercentage}
            onChange={(e) => setFormData({ ...formData, discountPercentage: e.target.value })}
            inputProps={{ min: 0, max: 100 }}
          />
        </Grid>
        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel>Inkluderte tjenester</InputLabel>
            <Select
              multiple
              value={formData.includedServices}
              onChange={(e) => setFormData({ ...formData, includedServices: e.target.value as any[] })}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as any[]).map((value) => {
                    const service = services?.find((s: any) => s.id === value);
                    return service ? <Chip key={value} label={service.service_name} size="small" /> : null;
                  })}
                </Box>
              )}
            >
              {Array.isArray(services) && services.map((service: any) => (
                <MenuItem key={service.id} value={service.id}>
                  {service.service_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.isVisible}
                onChange={(e) => setFormData({ ...formData, isVisible: e.target.checked })}
              />
            }
            label="Synlig for kunder"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
            }
            label="Aktiv pakke"
          />
        </Grid>
      </Grid>
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
        <Button onClick={onCancel}>Avbryt</Button>
        <Button
          variant="contained"
          onClick={() => onSave(formData)}
          sx={{
            background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
            color: 'white'
          }}
        >
          Lagre
        </Button>
      </Box>
    </Box>
  );
}

// Customer Pricing Form Component
function CustomerPricingForm({ customerPricing, clients, services, packages, onSave, onCancel }: any) {
  const [formData, setFormData] = useState({
    clientId: customerPricing?.client_id || '',
    pricingType: customerPricing?.pricing_type || 'service',
    itemId: customerPricing?.item_id || '',
    discountPercentage: customerPricing?.discount_percentage || 0,
    fixedPrice: customerPricing?.fixed_price || '',
    validFrom: customerPricing?.valid_from || new Date().toISOString().split('T')[0],
    validUntil: customerPricing?.valid_until || '',
    notes: customerPricing?.notes || ''
  });

  const availableItems = formData.pricingType === 'service' ? services : packages;

  return (
    <Box sx={{ pt: 2 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel>Kunde</InputLabel>
            <Select
              value={formData.clientId}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
            >
              {Array.isArray(clients) && clients.map((client: any) => (
                <MenuItem key={client.id} value={client.id}>
                  {client.name || client.first_name + ' ' + client.last_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              value={formData.pricingType}
              onChange={(e) => setFormData({ ...formData, pricingType: e.target.value, itemId: '' })}
            >
              <MenuItem value="service">Tjeneste</MenuItem>
              <MenuItem value="package">Pakke</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>{formData.pricingType === 'service' ? 'Tjeneste' : 'Pakke'}</InputLabel>
            <Select
              value={formData.itemId}
              onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
            >
              {Array.isArray(availableItems) && availableItems.map((item: any) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.service_name || item.package_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            type="number"
            label="Rabatt (%)"
            value={formData.discountPercentage}
            onChange={(e) => setFormData({ ...formData, discountPercentage: e.target.value })}
            inputProps={{ min: 0, max: 100 }}
            helperText="Prosent rabatt fra ordinær pris"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            type="number"
            label="Fast pris (NOK) - Valgfri"
            value={formData.fixedPrice}
            onChange={(e) => setFormData({ ...formData, fixedPrice: e.target.value })}
            helperText="Eller sett en fast pris i stedet for rabatt"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            type="date"
            label="Gyldig fra"
            value={formData.validFrom}
            onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            type="date"
            label="Gyldig til (valgfri)"
            value={formData.validUntil}
            onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
            InputLabelProps={{ shrink: true }}
            helperText="La stå tom for ingen utløpsdato"
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Notater"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            helperText="Eventuelle notater om denne kundeprisen"
          />
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
        <Button onClick={onCancel}>Avbryt</Button>
        <Button
          variant="contained"
          onClick={() => onSave(formData)}
          sx={{
            background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
            color: 'white'
          }}
        >
          Lagre
        </Button>
      </Box>
    </Box>
  );
}

// Service Form Component
function ServiceForm({ service, categories, onSave, onCancel }: any) {
  const [formData, setFormData] = useState({
    categoryId: service?.category_id ||', ',
    serviceName: service?.service_name || '',
    description: service?.description || '',
    basePrice: service?.base_price || '',
    priceType: service?.price_type || 'fixed',
    unit: service?.unit || 'stk',
    minimumQuantity: service?.minimum_quantity || 1,
    maximumQuantity: service?.maximum_quantity || ', ',
    isVisible: service?.is_visible ?? true,
    isActive: service?.is_active ?? true,
  });

  return (
    <Box sx={{ pt: 2 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Kategori</InputLabel>
            <Select
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
            >
              {Array.isArray(categories) && categories.map((cat: any) => (
                <MenuItem key={cat.id} value={cat.id}>
                  {cat.category_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Tjenestenavn"
            value={formData.serviceName}
            onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Beskrivelse"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            type="number"
            label="Grunnpris (NOK)"
            value={formData.basePrice}
            onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>Pristype</InputLabel>
            <Select
              value={formData.priceType}
              onChange={(e) => setFormData({ ...formData, priceType: e.target.value })}
            >
              <MenuItem value="fixed">Fast pris</MenuItem>
              <MenuItem value="per_hour">Per time</MenuItem>
              <MenuItem value="per_item">Per stykk</MenuItem>
              <MenuItem value="per_day">Per dag</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Enhet"
            value={formData.unit}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.isVisible}
                onChange={(e) => setFormData({ ...formData, isVisible: e.target.checked })}
              />
            }
            label="Synlig for kunder"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
            }
            label="Aktiv tjeneste"
          />
        </Grid>
      </Grid>
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
        <Button onClick={onCancel}>Avbryt</Button>
        <Button
          variant="contained"
          onClick={() => onSave(formData)}
          sx={{
            background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
            color:'white'
          }}
        >
          Lagre
        </Button>
      </Box>
    </Box>
  );
}