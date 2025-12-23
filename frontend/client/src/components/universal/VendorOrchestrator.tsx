import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from './hooks/useDynamicProfessions';
import { getAllVendorTypes, getEnabledVendorTypes } from '@shared/vendor-type-registry';
import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { 
  Box, 
  Typography, 
  Grid, 
  Card as MuiCard, 
  CardContent, 
  Chip, 
  LinearProgress, 
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Switch,
  FormControlLabel,
  Tooltip,
  Alert,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import { apiRequest } from '@/lib/queryClient';
import { 
  Store, 
  Settings, 
  TrendingUp as TimelineIcon, 
  People, 
  Build, 
  Cloud, 
  CheckCircle, 
  Warning, 
  Error,
  Info,
  PlayCircle,
  Pause,
  Refresh,
  Visibility,
  VisibilityOff,
  TrendingUp,
  Speed,
  Security,
  Memory,
  Storage,
  Link,
  AutoAwesome,
  Sync,
  Inventory,
  ShoppingCart,
  LocalShipping,
  Payment,
  Business
} from '@mui/icons-material';

/**
 * DYNAMIC VENDOR ORCHESTRATIONS
 * 
 * These orchestrations are VENDOR-TYPE-AGNOSTIC and adapt to ANY vendor type
 * configured through VendorTypeManager.
 * 
 * Supported vendor types are managed dynamically via:
 * - @shared/vendor-type-registry.ts (core & expandable types)
 * - VendorTypeManager component (admin can add/remove types)
 * - API: /api/vendor-types (fetches active types)
 * 
 * Current vendor types in registry:
 * - print, audio, design, software, hardware (core)
 * - video, education, services (expandable)
 * - ANY future types added through VendorTypeManager
 * 
 * Each vendor type has:
 * - supportedFeatures: {showcase, pricing, inventory, bookings, subscriptions, downloads, physical_shipping, digital_delivery}
 * - productCategories: dynamically managed per type
 * - primaryActions: type-specific quick actions
 * 
 * Orchestrations automatically adapt based on vendor type configuration.
 */
const VENDOR_ORCHESTRATIONS = {
  vendorOnboarding: {
    name: 'Dynamisk Vendor Onboarding (Alle Typer)',
    trigger: 'vendor_registration',
    description: 'Adapts to ANY vendor type from VendorTypeManager',
    actions: [
      {
        component: 'BRREGIntegration',
        action: 'validateBusiness',
        autoTrigger: true,
        notes: 'Required for all Norwegian vendors'
      },
      {
        component: 'VendorTypeManager',
        action: 'fetchAvailableTypes',
        dependsOn: 'BRREGIntegration.success',
        notes: 'Dynamically loads all vendor types from registry + API'
      },
      {
        component: 'VendorTypeManager',
        action: 'selectVendorType',
        dependsOn: 'VendorTypeManager.fetchAvailableTypes',
        notes: 'User selects from available types (print, audio, design, etc.)'
      },
      {
        component: 'VendorTypeManager',
        action: 'setupTypeSpecificCategories',
        dependsOn: 'VendorTypeManager.selectVendorType',
        notes: 'Categories adapt to selected vendor type'
      },
      {
        component: 'ShowcaseLanding',
        action: 'createTypeSpecificShowcase',
        dependsOn: 'VendorTypeManager.setupTypeSpecificCategories',
        notes: 'Showcase adapts to vendor type features (showcase, pricing, inventory, etc.)'
      },
      {
        component: 'GoogleDriveProjectSync',
        action: 'createVendorWorkspace',
        dependsOn: 'ShowcaseLanding.createTypeSpecificShowcase'
      }
    ],
    status: 'active'
  },
  quickProductAdd: {
    name: 'Universal Quick Add (<30 sek) - Alle Typer',
    trigger: 'quick_product_add',
    description: 'Dynamically adapts form and workflow based on vendor type and supportedFeatures',
    actions: [
      {
        component: 'VendorProductManager',
        action: 'detectVendorType',
        autoTrigger: true,
        notes: 'Fetches current vendor type from user profile'
      },
      {
        component: 'VendorTypeManager',
        action: 'loadTypeConfiguration',
        dependsOn: 'VendorProductManager.detectVendorType',
        notes: 'Loads supportedFeatures, categories, and primaryActions for this type'
      },
      {
        component: 'VendorProductManager',
        action: 'renderDynamicForm',
        dependsOn: 'VendorTypeManager.loadTypeConfiguration',
        notes: 'Form adapts to: inventory (physical), downloads (digital), bookings (services), subscriptions'
      },
      {
        component: 'VendorProductManager',
        action: 'autoFillFromTypeTemplates',
        dependsOn: 'VendorProductManager.renderDynamicForm',
        notes: 'Uses type-specific templates (print templates, audio presets, design brushes, etc.)'
      },
      {
        component: 'VendorProductManager',
        action: 'suggestPricingByType',
        dependsOn: 'VendorProductManager.autoFillFromTypeTemplates',
        notes: 'Pricing strategy adapts to type (one-time, subscription, rental, download)'
      },
      {
        component: 'VendorProductManager',
        action: 'publishToTypeMarketplace',
        dependsOn: 'VendorProductManager.suggestPricingByType',
        notes: 'Publishes to correct marketplace category based on type'
      }
    ],
    status: 'active'
  },
  bulkProductImport: {
    name: 'Bulk Import (Produkter/Tjenester/Innhold)',
    trigger: 'bulk_import_initiated',
    actions: [
      {
        component: 'VendorProductManager',
        action: 'detectImportType',
        autoTrigger: true
      },
      {
        component: 'VendorProductManager',
        action: 'validateImportData',
        dependsOn: 'VendorProductManager.detectImportType'
      },
      {
        component: 'VendorProductManager',
        action: 'enrichWithAIMetadata',
        dependsOn: 'VendorProductManager.validateImportData'
      },
      {
        component: 'VendorProductManager',
        action: 'batchCreateItems',
        dependsOn: 'VendorProductManager.enrichWithAIMetadata'
      },
      {
        component: 'ShowcaseLanding',
        action: 'updateMarketplace',
        dependsOn: 'VendorProductManager.batchCreateItems'
      }
    ],
    status: 'active'
  },
  productCloning: {
    name: 'Rask Duplikering (Produkter/Tjenester)',
    trigger: 'item_clone_requested',
    actions: [
      {
        component: 'VendorProductManager',
        action: 'loadSourceItem',
        autoTrigger: true
      },
      {
        component: 'VendorProductManager',
        action: 'duplicateWithVariations',
        dependsOn: 'VendorProductManager.loadSourceItem'
      },
      {
        component: 'VendorProductManager',
        action: 'customizeForNewVersion',
        dependsOn: 'VendorProductManager.duplicateWithVariations'
      },
      {
        component: 'ShowcaseLanding',
        action: 'publishToMarketplace',
        dependsOn: 'VendorProductManager.customizeForNewVersion'
      }
    ],
    status: 'active'
  },
  smartItemEdit: {
    name: 'Smart Redigering med AI-anbefalinger',
    trigger: 'item_edit_started',
    actions: [
      {
        component: 'VendorProductManager',
        action: 'loadItemForEdit',
        autoTrigger: true
      },
      {
        component: 'BusinessIntelligenceDashboard',
        action: 'analyzeMarketPosition',
        dependsOn: 'VendorProductManager.loadItemForEdit'
      },
      {
        component: 'VendorProductManager',
        action: 'suggestOptimizations',
        dependsOn: 'BusinessIntelligenceDashboard.analyzeMarketPosition'
      },
      {
        component: 'VendorProductManager',
        action: 'applyChanges',
        dependsOn: 'VendorProductManager.suggestOptimizations'
      },
      {
        component: 'ShowcaseLanding',
        action: 'updateListing',
        dependsOn: 'VendorProductManager.applyChanges'
      }
    ],
    status: 'active'
  },
  newVendorTypeDetected: {
    name: 'Ny Vendor Type Oppdaget (Auto-adapt)',
    trigger: 'vendor_type_added_or_updated',
    description: 'Automatically adapts system when admin adds new vendor type via VendorTypeManager',
    actions: [
      {
        component: 'VendorTypeManager',
        action: 'refreshVendorTypeRegistry',
        autoTrigger: true,
        notes: 'Reloads all vendor types from API and registry'
      },
      {
        component: 'VendorProductManager',
        action: 'updateFormTemplates',
        dependsOn: 'VendorTypeManager.refreshVendorTypeRegistry',
        notes: 'Adds form fields for new type'
      },
      {
        component: 'ShowcaseLanding',
        action: 'addMarketplaceCategory',
        dependsOn: 'VendorProductManager.updateFormTemplates',
        notes: 'Creates new marketplace category for new type'
      },
      {
        component: 'BusinessIntelligenceDashboard',
        action: 'setupTypeAnalytics',
        dependsOn: 'ShowcaseLanding.addMarketplaceCategory',
        notes: 'Initializes analytics tracking for new type'
      },
      {
        component: 'UniversalCommunication',
        action: 'notifyVendorsOfNewType',
        dependsOn: 'BusinessIntelligenceDashboard.setupTypeAnalytics',
        notes: 'Informs existing vendors about new opportunities'
      }
    ],
    status: 'active'
  },
  typeSpecificTemplates: {
    name: 'Dynamiske Type Maler (Auto-generert)',
    trigger: 'template_based_creation',
    description: 'Templates automatically available for ALL vendor types - system adapts as new types are added',
    actions: [
      {
        component: 'VendorTypeManager',
        action: 'fetchAllVendorTypes',
        autoTrigger: true,
        notes: 'Gets ALL enabled vendor types (current + future types)'
      },
      {
        component: 'VendorTypeManager',
        action: 'loadTemplatesForAllTypes',
        dependsOn: 'VendorTypeManager.fetchAllVendorTypes',
        notes: 'Dynamically loads templates for each type (print, audio, design, + any new types)'
      },
      {
        component: 'VendorProductManager',
        action: 'presentTypeFilteredTemplates',
        dependsOn: 'VendorTypeManager.loadTemplatesForAllTypes',
        notes: 'Shows only templates relevant to user\'s vendor type'
      },
      {
        component: 'VendorProductManager',
        action: 'customizeWithTypeContext',
        dependsOn: 'VendorProductManager.presentTypeFilteredTemplates',
        notes: 'Customization options adapt to type (colors for design, BPM for audio, etc.)'
      },
      {
        component: 'BusinessIntelligenceDashboard',
        action: 'suggestTypeAppropiatePricing',
        dependsOn: 'VendorProductManager.customizeWithTypeContext',
        notes: 'Pricing strategy matches type (physical rental, digital download, service booking, subscription)'
      },
      {
        component: 'ShowcaseLanding',
        action: 'publishToTypeMarketplace',
        dependsOn: 'BusinessIntelligenceDashboard.suggestTypeAppropiatePricing',
        notes: 'Routes to correct marketplace section based on vendor type'
      }
    ],
    status: 'active'
  },
  realTimeMarketplaceSync: {
    name: 'Sanntids Marketplace Synkronisering',
    trigger: 'marketplace_update',
    actions: [
      {
        component: 'VendorProductManager',
        action: 'detectChanges',
        autoTrigger: true
      },
      {
        component: 'ShowcaseLanding',
        action: 'updateShowcase',
        dependsOn: 'VendorProductManager.detectChanges'
      },
      {
        component: 'UniversalCommunication',
        action: 'notifySubscribers',
        dependsOn: 'ShowcaseLanding.updateShowcase'
      },
      {
        component: 'BusinessIntelligenceDashboard',
        action: 'trackEngagement',
        dependsOn: 'UniversalCommunication.notifySubscribers'
      }
    ],
    status: 'active'
  },
  dynamicPricing: {
    name: 'Dynamisk Prisoptimalisering',
    trigger: 'pricing_optimization_requested',
    actions: [
      {
        component: 'BusinessIntelligenceDashboard',
        action: 'analyzeCompetitors',
        autoTrigger: true
      },
      {
        component: 'BusinessIntelligenceDashboard',
        action: 'analyzeSeasonalTrends',
        dependsOn: 'BusinessIntelligenceDashboard.analyzeCompetitors'
      },
      {
        component: 'VendorProductManager',
        action: 'calculateOptimalPrices',
        dependsOn: 'BusinessIntelligenceDashboard.analyzeSeasonalTrends'
      },
      {
        component: 'VendorProductManager',
        action: 'applyPricingStrategy',
        dependsOn: 'VendorProductManager.calculateOptimalPrices'
      },
      {
        component: 'EmailDesigner',
        action: 'notifyCustomers',
        dependsOn: 'VendorProductManager.applyPricingStrategy'
      }
    ],
    status: 'active'
  },
  orderFulfillment: {
    name: 'Universal Order Fulfillment',
    trigger: 'order_received',
    actions: [
      {
        component: 'VendorTypeManager',
        action: 'detectFulfillmentType',
        autoTrigger: true
      },
      {
        component: 'VendorProductManager',
        action: 'processOrder',
        dependsOn: 'VendorTypeManager.detectFulfillmentType'
      },
      {
        component: 'GoogleDriveProjectSync',
        action: 'createOrderFolder',
        dependsOn: 'VendorProductManager.processOrder'
      },
      {
        component: 'ContractGenerator',
        action: 'generateInvoice',
        dependsOn: 'GoogleDriveProjectSync.createOrderFolder'
      },
      {
        component: 'UniversalChatWidget',
        action: 'confirmWithCustomer',
        dependsOn: 'ContractGenerator.generateInvoice'
      }
    ],
    status: 'active'
  },
  digitalDelivery: {
    name: 'Automatisk Digital Levering',
    trigger: 'digital_product_purchased',
    actions: [
      {
        component: 'VendorProductManager',
        action: 'validatePurchase',
        autoTrigger: true
      },
      {
        component: 'GoogleDriveProjectSync',
        action: 'packageFiles',
        dependsOn: 'VendorProductManager.validatePurchase'
      },
      {
        component: 'UniversalFileUpload',
        action: 'generateDownloadLinks',
        dependsOn: 'GoogleDriveProjectSync.packageFiles'
      },
      {
        component: 'EmailDesigner',
        action: 'sendDeliveryEmail',
        dependsOn: 'UniversalFileUpload.generateDownloadLinks'
      },
      {
        component: 'BusinessIntelligenceDashboard',
        action: 'trackSale',
        dependsOn: 'EmailDesigner.sendDeliveryEmail'
      }
    ],
    status: 'active'
  },
  subscriptionManagement: {
    name: 'Abonnement og Recurring Billing',
    trigger: 'subscription_created',
    actions: [
      {
        component: 'VendorProductManager',
        action: 'setupSubscription',
        autoTrigger: true
      },
      {
        component: 'ContractGenerator',
        action: 'generateSubscriptionAgreement',
        dependsOn: 'VendorProductManager.setupSubscription'
      },
      {
        component: 'UniversalCommunication',
        action: 'sendWelcomePackage',
        dependsOn: 'ContractGenerator.generateSubscriptionAgreement'
      },
      {
        component: 'BusinessIntelligenceDashboard',
        action: 'setupRecurringBilling',
        dependsOn: 'UniversalCommunication.sendWelcomePackage'
      },
      {
        component: 'GoogleDriveProjectSync',
        action: 'grantAccessToResources',
        dependsOn: 'BusinessIntelligenceDashboard.setupRecurringBilling'
      }
    ],
    status: 'active'
  },
  orderProcessing: {
    name: 'Automatisk Ordrebehandling',
    trigger: 'order_received',
    description: 'Complete order workflow from receipt to delivery',
    actions: [
      {
        component: 'VendorOrdersManager',
        action: 'validateOrder',
        autoTrigger: true,
        notes: 'Validates order data and payment status'
      },
      {
        component: 'VendorInventoryManager',
        action: 'checkStock',
        dependsOn: 'VendorOrdersManager.validateOrder',
        notes: 'Verifies product availability'
      },
      {
        component: 'VendorInventoryManager',
        action: 'reserveStock',
        dependsOn: 'VendorInventoryManager.checkStock',
        notes: 'Reserves items for order'
      },
      {
        component: 'VendorOrdersManager',
        action: 'updateStatus_processing',
        dependsOn: 'VendorInventoryManager.reserveStock'
      },
      {
        component: 'UniversalCommunication',
        action: 'sendOrderConfirmation',
        dependsOn: 'VendorOrdersManager.updateStatus_processing'
      },
      {
        component: 'VendorOrdersManager',
        action: 'generatePackingSlip',
        dependsOn: 'UniversalCommunication.sendOrderConfirmation'
      },
      {
        component: 'VendorOrdersManager',
        action: 'updateStatus_shipped',
        dependsOn: 'VendorOrdersManager.generatePackingSlip',
        notes: 'Updates when physically shipped or digitally delivered'
      },
      {
        component: 'UniversalCommunication',
        action: 'sendShippingNotification',
        dependsOn: 'VendorOrdersManager.updateStatus_shipped'
      }
    ],
    status: 'active'
  },
  inventoryManagement: {
    name: 'Smart Lagerstyring',
    trigger: 'inventory_threshold_reached',
    description: 'Automated inventory monitoring and reorder alerts',
    actions: [
      {
        component: 'VendorInventoryManager',
        action: 'checkStockLevels',
        autoTrigger: true,
        notes: 'Runs every hour to check all products'
      },
      {
        component: 'VendorInventoryManager',
        action: 'identifyLowStock',
        dependsOn: 'VendorInventoryManager.checkStockLevels',
        notes: 'Identifies products below reorder point'
      },
      {
        component: 'VendorTasksWidget',
        action: 'createReorderTask',
        dependsOn: 'VendorInventoryManager.identifyLowStock',
        notes: 'Creates actionable task for vendor'
      },
      {
        component: 'UniversalCommunication',
        action: 'sendLowStockAlert',
        dependsOn: 'VendorTasksWidget.createReorderTask',
        notes: 'Email/SMS notification to vendor'
      },
      {
        component: 'BusinessIntelligenceDashboard',
        action: 'updateInventoryMetrics',
        dependsOn: 'UniversalCommunication.sendLowStockAlert',
        notes: 'Updates dashboard with inventory health'
      },
      {
        component: 'VendorInventoryManager',
        action: 'suggestReorderQuantity',
        dependsOn: 'BusinessIntelligenceDashboard.updateInventoryMetrics',
        notes: 'AI-powered reorder quantity suggestions based on sales trends'
      }
    ],
    status: 'active'
  },
  vendorOnboardingProgress: {
    name: 'Vendor Onboarding Progress Tracking',
    trigger: 'vendor_action_completed',
    description: 'Tracks vendor onboarding tasks and milestones',
    actions: [
      {
        component: 'VendorTasksWidget',
        action: 'updateTaskProgress',
        autoTrigger: true,
        notes: 'Updates task completion status'
      },
      {
        component: 'VendorQuickStats',
        action: 'refreshStats',
        dependsOn: 'VendorTasksWidget.updateTaskProgress',
        notes: 'Updates dashboard stats (products, orders, etc.)'
      },
      {
        component: 'VendorTasksWidget',
        action: 'checkMilestones',
        dependsOn: 'VendorQuickStats.refreshStats',
        notes: 'Checks if major milestones achieved (e.g., 3 products, first sale)'
      },
      {
        component: 'UniversalCommunication',
        action: 'sendCelebrationNotification',
        dependsOn: 'VendorTasksWidget.checkMilestones',
        notes: 'Sends encouragement/celebration when milestones reached'
      },
      {
        component: 'VendorTasksWidget',
        action: 'suggestNextSteps',
        dependsOn: 'UniversalCommunication.sendCelebrationNotification',
        notes: 'AI-powered suggestions for next tasks based on vendor progress'
      },
      {
        component: 'BusinessIntelligenceDashboard',
        action: 'trackOnboardingMetrics',
        dependsOn: 'VendorTasksWidget.suggestNextSteps',
        notes: 'Analytics on vendor onboarding completion rates'
      }
    ],
    status: 'active'
  },
  quickStatsRefresh: {
    name: 'Dashboard Quick Stats Auto-Refresh',
    trigger: 'realtime_data_update',
    description: 'Keeps vendor dashboard stats current',
    actions: [
      {
        component: 'VendorQuickStats',
        action: 'fetchLatestStats',
        autoTrigger: true,
        notes: 'Fetches product count, orders, inventory, revenue'
      },
      {
        component: 'VendorOrdersManager',
        action: 'countPendingOrders',
        dependsOn: 'VendorQuickStats.fetchLatestStats'
      },
      {
        component: 'VendorInventoryManager',
        action: 'countLowStock',
        dependsOn: 'VendorOrdersManager.countPendingOrders'
      },
      {
        component: 'VendorQuickStats',
        action: 'updateDisplay',
        dependsOn: 'VendorInventoryManager.countLowStock',
        notes: 'Updates UI with latest data'
      },
      {
        component: 'VendorTasksWidget',
        action: 'updateTaskCounts',
        dependsOn: 'VendorQuickStats.updateDisplay',
        notes: 'Updates task completion percentages'
      }
    ],
    status: 'active'
  },
  orderFulfillmentAlert: {
    name: 'Ordre Klar for Levering',
    trigger: 'order_ready_for_fulfillment',
    description: 'Alerts vendor when orders need attention',
    actions: [
      {
        component: 'VendorOrdersManager',
        action: 'identifyPendingOrders',
        autoTrigger: true,
        notes: 'Finds orders in pending status > 24 hours'
      },
      {
        component: 'VendorQuickStats',
        action: 'showPendingOrdersAlert',
        dependsOn: 'VendorOrdersManager.identifyPendingOrders',
        notes: 'Shows red badge on dashboard'
      },
      {
        component: 'UniversalCommunication',
        action: 'sendFulfillmentReminder',
        dependsOn: 'VendorQuickStats.showPendingOrdersAlert',
        notes: 'Email/push notification'
      },
      {
        component: 'VendorTasksWidget',
        action: 'createFulfillmentTask',
        dependsOn: 'UniversalCommunication.sendFulfillmentReminder',
        notes: 'Adds "Process pending orders" task'
      }
    ],
    status: 'active'
  }
};

// Aktive orkestreringsdata
interface OrchestrationState {
  [key: string]: {
    running: boolean;
    lastRun: Date | null;
    completedActions: string[];
    failedActions: string[];
}
}

// Sanntids systemstatistikker
const SYSTEM_METRICS = [
  { name: 'CPU Usage', value: 0, unit: ', %', type: 'performance', threshold: 80,},
  { name: 'Memory Usage', value: 0, unit: ', %', type: 'performance', threshold: 85,},
  { name: 'Storage Usage', value: 0, unit: ', %', type: 'storage', threshold: 90,},
  { name: 'Network Latency', value: 0, unit: 'ms', type: 'network', threshold: 200,},
  { name: 'Pending Orders', value: 0, unit: ',', type: 'orders', threshold: 50,},
  { name: 'Inventory Items', value: 0, unit: ',', type: 'inventory', threshold: 1000,}
];

interface VendorOrchestratorProps {
  sessionId?: string;
  activeWorkflow?: string;
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
  selectedClient?: any
}

export default function VendorOrchestrator({ 
  sessionId,
  activeWorkflow = 'nyBestilling',
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
  selectedClient
}: VendorOrchestratorProps) {
  const [selectedOrchestration, setSelectedOrchestration] = useState(activeWorkflow);
  const [showSystemMetrics, setShowSystemMetrics] = useState(false);
  const [orchestrationStates, setOrchestrationStates] = useState<OrchestrationState>({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
  const [manualTriggerData, setManualTriggerData] = useState<any>({});

  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('vendor');
  
  // Profession system integration
  const { professionConfig, isLoading: configLoading } = useProfessionConfigs('vendor');
  const { professionAdapter } = useProfessionAdapter('vendor');
  const professionIcon = getProfessionIcon('vendor');
  const { professions: dynamicProfessions } = useDynamicProfessions();

  // Orkestreringsstatuser
  const { data: orchestrationStatus = {}, isLoading } = useQuery({
    queryKey: ['/api/vendor/orchestration/status', sessionId],
    queryFn: () => apiRequest(`/api/vendor/orchestration/status/${sessionId}`),
    retry: false,
    refetchInterval: 2000 // Real-time oppdateringer
  });

  // System metrics query
  const { data: systemMetrics = {} } = useQuery({
    queryKey: ['/api/system/metrics'],
    queryFn: () => apiRequest('/api/system/metrics'),
    retry: false,
    refetchInterval: 3000 });

  // Trigger orchestration
  const triggerOrchestration = useMutation({
    mutationFn: async ({ orchestrationd, triggerData }: { orchestrationId: string, triggerData: any }) => {
      return apiRequest(`/api/vendor/orchestration/trigger`, {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POS',
        body: { orchestrationd, triggerData, sessionId }
    });
  },
    onSuccess: (data, variables) => {
      setOrchestrationStates(prev => ({
        ...prev,
        [variables.orchestrationId]: {
          running: true,
          lastRun: new Date(),
          completedActions:  [],
          failedActions: []
    }
    }));
      queryClient.invalidateQueries({ queryKey: ['/api/vendor/orchestration/status', ],});
  }
});

  const handleOrchestrationTrigger = (orchestrationId: string, triggerData?: any) => {
    triggerOrchestration.mutate({ orchestrationId, triggerData: triggerData || {} });
};

  const openOrchestrationDetails = (orchestrationKey: string) => {
    setSelectedOrchestration(orchestrationKey);
    setDetailsOpen(true);
};

  const getMetricColor = (metric: any) => {
    if (metric.value > metric.threshold) return '#f44336'; // Red
    if (metric.value > metric.threshold * 0.8) return '#ff9800'; // Orange
    return '#4caf50'; // Green
};

  const getOrchestrationStatusColor = (orchestrationKey: string) => {
    const state = orchestrationStates[orchestrationKey] || orchestrationStatus[orchestrationKey];
    if (state?.running) return '#4caf50'; // Green
    if (VENDOR_ORCHESTRATIONS[orchestrationKey]?.status === 'active') return '#ff5722'; // Orange-red
    return '#757575'; // Gray
};

  if (isLoading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px',
        background: 'linear-gradient(135deg, #ff5722 0%, #ff7043 100%)',
        borderRadius: '16px'
  }}>
        <LinearProgress sx={{ width: '200px', height: '6px', borderRadius: '3px'}} />
      </Box>
    );
}

  return (
    <Box component="main" role="main" aria-label="Vendor orkestrering" sx={{ p: 3 }}>
      {/* Header med vendor-identitet */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', color: theming.colors.primary, fontSize: 40 }} aria-hidden="true">
          {professionIcon || <Store sx={{ color: '#ff5720', fontSize: 40 }} aria-hidden="true" />}
        </Box>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, color: theming.colors.primary }}>
            {professionConfig?.displayName || 'Vendor'} Orkestrering
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Automatisk sammenkobling av leverandør og lager komponenter
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <FormControlLabel
            control={
              <Switch 
                checked={showSystemMetrics}
                onChange={(e) => setShowSystemMetrics(e.target.checked)}
                color="primary"
                inputProps={{ 
                  'aria-label': 'Vis system metrics',
                  role: 'switch'
                }}
                sx={{
                  '&:focus-visible': {
                    outline: '3px solid #ff5722',
                    outlineOffset: '2px'
                  }
                }}
              />
          }
            label="System Metrics"
          />
          <Button 
            variant="contained"
            startIcon={React.cloneElement(theming.getThemedIcon('playCircle'), { 'aria-hidden': true })}
            onClick={() => setTriggerDialogOpen(true)}
            aria-label="Start manual trigger"
            sx={{ 
              bgcolor: '#ff5722',
              minHeight: 48,
              '&:focus-visible': {
                outline: '3px solid #ff5722',
                outlineOffset: '2px'
              }
            }}
          >
            Manual Trigger
          </Button>
        </Box>
      </Box>

	      {/* System Metrics (når aktivert) */}
	      {showSystemMetrics && (
	        <Grid container spacing={2} sx={{ mb: 4 }}>
	          {systemMetrics.map((metric, index) => (
	            <Grid size={{ xs: 6 }} md={2} key={index}>
	              <MuiCard
	                sx={{
	                  border: `2px solid ${getMetricColor(metric)}20`, '&:hover': {
	                    borderColor: getMetricColor(metric),
	                  }}}
	              >
	                <CardContent sx={{ textAlign: 'center', py: 1, ...theming.getThemedCardSx() }}>
	                  <Typography variant="h6" sx={{ color: getMetricColor(metric) }}>
	                    {metric.value},{metric.unit}
	                  </Typography>
	                  <Typography variant="caption" color="text.secondary">
	                    {metric.name}
	                  </Typography>
	                </CardContent>
	              </MuiCard>
	            </Grid>
	          ))}
	        </Grid>
	      )}

	      {/* Orkestreringer Overview */}
	      <Grid container spacing={3}>
	        {Object.entries(VENDOR_ORCHESTRATIONS).map(([orchestrationKey, orchestration]) => (
	          <Grid item xs={12} md={6} lg={4} key={orchestrationKey}>
	            <MuiCard
	              sx={{
	                height: '400px',
	                border: `2px solid ${getOrchestrationStatusColor(orchestrationKey)}20`, '&:hover': {
	                  borderColor: getOrchestrationStatusColor(orchestrationKey),
	                  transform: 'translateY(-4px)',
	                  transition: 'all 0.3s ease',
	                  boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
	                }}}
	            >
	              <CardContent sx={theming.getThemedCardSx()}>
	                {/* Orkestrering Header */}
	                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
	                  <Typography
	                    variant="h6"
	                    sx={{
	                      color: theming.colors.primary,
	                      fontWeight: 600}}
	                  >
	                    {orchestration.name}
	                  </Typography>
	                  <Chip
	                    label={orchestrationStates[orchestrationKey]?.running ? 'Aktiv' : 'Klar'}
	                    size="small"
	                    color={orchestrationStates[orchestrationKey]?.running ? 'success' : 'default'}
	                    icon={
	                      orchestrationStates[orchestrationKey]?.running
	                        ? theming.getThemedIcon('sync')
	                        : theming.getThemedIcon('playCircle')
	                    }
	                  />
	                </Box>

	                {/* Trigger Info */}
	                <Box sx={{ mb: 2 }}>
	                  <Typography variant="body2" color="text.secondary">
	                    Trigger: <strong>{orchestration.trigger}</strong>
	                  </Typography>
	                  <LinearProgress
	                    variant={orchestrationStates[orchestrationKey]?.running ? 'indeterminate' : 'determinate'}
	                    value={orchestrationStates[orchestrationKey]?.running ? undefined : 0}
	                    sx={{
	                      height: 6,
	                      borderRadius: 3,
	                      mt: 1,
	                      backgroundColor: `${getOrchestrationStatusColor(orchestrationKey)}20`,
	                      '& .MuiLinearProgress-bar': {
	                        backgroundColor: getOrchestrationStatusColor(orchestrationKey),
	                      }
	                    }}
	                  />
	                </Box>

	                {/* Actions Flow */}
	                <List dense sx={{ maxHeight: 10, overflow: 'auto' }}>
	                  {orchestration.actions.map((action, index) => (
	                    <ListItem key={index} sx={{ px: 0 }}>
	                      <ListItemIcon sx={{ minWidth: 32 }}>
	                        <Link sx={{ fontSize: 16, color: getOrchestrationStatusColor(orchestrationKey) }} />
	                      </ListItemIcon>
	                      <ListItemText
	                        primary={action.component}
	                        secondary={action.action}
	                        primaryTypographyProps={{ variant: 'body2', fontWeight: 600}}
	                        secondaryTypographyProps={{ variant: 'caption' }}
	                      />
	                    </ListItem>
	                  ))}
	                </List>

	                {/* Control Buttons */}
	                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
	                  <Button
	                    size="small"
	                    variant="contained"
	                    color="primary"
	                    startIcon={theming.getThemedIcon('sync')}
	                    onClick={() => handleOrchestrationTrigger(orchestrationKey)}
	                    disabled={triggerOrchestration.isPending}
	                  >
	                    Trigger
	                  </Button>
	                  <Button
	                    size="small"
	                    variant="outlined"
	                    startIcon={theming.getThemedIcon('info')}
	                    onClick={() => openOrchestrationDetails(orchestrationKey)}
	                  >
	                    Detaljer
	                  </Button>
	                </Box>
	              </CardContent>
	            </MuiCard>
	          </Grid>
	        ))}
	      </Grid>

	      {/* Status Alert */}
	      <Alert
	        severity="success"
	        sx={{ mt: 4 }}
	        icon={theming.getThemedIcon('store')}
	      >
	        <Typography variant="body1">
	          <strong>Vendor Orkestrering</strong> er aktiv og overvåker {Object.keys(VENDOR_ORCHESTRATIONS).length} automatiserte workflows.
	          {sessionId && ` Sesjon: ${sessionId}`}
	        </Typography>
	      </Alert>

      {/* Manual Trigger Dialog */}
      <Dialog 
        open={triggerDialogOpen}
        onClose={() => setTriggerDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Manual Trigger</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt:  2 }}>
            <InputLabel>Velg Orkestrering</InputLabel>
            <Select
              value={selectedOrchestration}
              onChange={(e) => setSelectedOrchestration(e.target.value)}
            >
              {Object.entries(VENDOR_ORCHESTRATIONS).map(([key, orchestration]) => (
                <MenuItem key={key} value={key}>
                  {orchestration.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Trigger Data (JSON)"
            placeholder='{"productId" : "12345""quantity": 5}'
            value={JSON.stringify(manualTriggerData)}
            onChange={(e) => {
              try {
                setManualTriggerData(JSON.parse(e.target.value || '{}'));
            } catch {
                // Invalid JSON, ignore
            }
          }}
            sx={{ mt:  2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTriggerDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained"
            onClick={() => {
              if (selectedOrchestration) {
                handleOrchestrationTrigger(selectedOrchestration, manualTriggerData);
                setTriggerDialogOpen(false);
            }
          }}
            disabled={!selectedOrchestration}
          >
            Trigger
          </Button>
        </DialogActions>
      </Dialog>

      {/* Orkestrering Details Dialog */}
      <Dialog 
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedOrchestration && VENDOR_ORCHESTRATIONS[selectedOrchestration]?.name} - Detaljer
        </DialogTitle>
        <DialogContent>
          {selectedOrchestration && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Trigger: </Typography>
              <Chip 
                label={VENDOR_ORCHESTRATIONS[selectedOrchestration].trigger}
                color="primary"
                sx={{ mb: 2 }}
              />
              
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Automatiserte Aksjoner: </Typography>
              <List>
                {VENDOR_ORCHESTRATIONS[selectedOrchestration].actions.map((action, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <Link color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={action.component}
                      secondary={`${action.action}${action.dependsOn ? ` (avhenger av: ${action.dependsn})` :''}`}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}