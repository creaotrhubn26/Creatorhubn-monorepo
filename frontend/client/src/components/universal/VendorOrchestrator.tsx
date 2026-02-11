import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from './hooks/useDynamicProfessions';
import { getAllVendorTypes, getEnabledVendorTypes } from '@shared/vendor-type-registry';
import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
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
  const { user } = useAuth();
  const { professionConfigs, isLoading: configLoading } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const professionIcon = getProfessionIcon('vendor');
  const { professions: dynamicProfessions } = useDynamicProfessions();
  const activeProfession = professionAdapter?.profession || 'vendor';
  const professionConfig = professionConfigs?.[activeProfession];
  const dynamicProfession = dynamicProfessions?.[activeProfession];
  const professionDisplayName = dynamicProfession?.displayName || 'Vendor';
  const projectTypes = professionAdapter?.getProjectTypes?.() || [];
  const allVendorTypes = getAllVendorTypes();
  const enabledVendorTypes = getEnabledVendorTypes();

  useEffect(() => {
    if (activeWorkflow && activeWorkflow !== selectedOrchestration) {
      setSelectedOrchestration(activeWorkflow);
    }
  }, [activeWorkflow, selectedOrchestration]);

  useEffect(() => {
    if (!sessionId && !selectedProject && !selectedClient) return;
    setManualTriggerData(prev => ({
      ...prev,
      sessionId: sessionId ?? prev.sessionId,
      projectId: selectedProject?.id ?? prev.projectId,
      clientId: selectedClient?.id ?? prev.clientId
    }));
  }, [sessionId, selectedProject, selectedClient]);

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
    mutationFn: async ({ orchestrationId, triggerData }: { orchestrationId: string; triggerData: any }) => {
      return apiRequest(`/api/vendor/orchestration/trigger`, {
        headers: {
          "Content-Type": "application/json"
        },
        method: 'POST',
        body: { orchestrationId, triggerData, sessionId }
      });
    },
    onSuccess: (data, variables) => {
      setOrchestrationStates(prev => ({
        ...prev,
        [variables.orchestrationId]: {
          running: true,
          lastRun: new Date(),
          completedActions: [],
          failedActions: []
        }
      }));
      queryClient.invalidateQueries({ queryKey: ['/api/vendor/orchestration/status', sessionId] });
    }
  });

  const handleOrchestrationTrigger = (orchestrationId: string, triggerData?: any) => {
    const timestamp = new Date().toISOString();
    const projectContext = selectedProject || {
      id: `vendor-${Date.now()}`,
      name: 'Ny vendor prosjekt',
      type: orchestrationId
    };
    const clientContext = selectedClient || {
      id: `customer-${Date.now()}`,
      name: 'Ny kunde'
    };

    switch (orchestrationId) {
      case 'vendorOnboarding':
        onClientSelect?.(clientContext);
        onProjectSelect?.(projectContext);
        onProjectUpdate?.({
          ...projectContext,
          status: 'onboarding',
          updatedAt: timestamp
        });
        onMeetingCreate?.({
          title: 'Vendor onboarding kickoff',
          clientId: clientContext.id,
          scheduledAt: timestamp
        });
        onWorklogCreate?.({
          projectId: projectContext.id,
          description: 'Startet vendor onboarding',
          loggedAt: timestamp
        });
        break;
      case 'quickProductAdd':
        onProjectUpdate?.({
          ...projectContext,
          status: 'quick-add',
          updatedAt: timestamp
        });
        onWorklogCreate?.({
          projectId: projectContext.id,
          description: 'Quick add produkt i gang',
          loggedAt: timestamp
        });
        break;
      case 'bulkProductImport':
        onFileUpload?.({
          projectId: projectContext.id,
          fileName: 'bulk-import.csv',
          uploadedAt: timestamp
        });
        onWorklogCreate?.({
          projectId: projectContext.id,
          description: 'Bulk import startet',
          loggedAt: timestamp
        });
        break;
      case 'productCloning':
        onProjectUpdate?.({
          ...projectContext,
          status: 'cloning',
          updatedAt: timestamp
        });
        onWorklogCreate?.({
          projectId: projectContext.id,
          description: 'Produkt duplisering startet',
          loggedAt: timestamp
        });
        break;
      case 'smartItemEdit':
        onProjectUpdate?.({
          ...projectContext,
          status: 'optimizing',
          updatedAt: timestamp
        });
        onWorklogCreate?.({
          projectId: projectContext.id,
          description: 'Smart item edit med AI',
          loggedAt: timestamp
        });
        break;
      case 'newVendorTypeDetected':
        onShowcaseCreate?.({
          title: 'Ny vendor type tilgjengelig',
          createdAt: timestamp
        });
        onWorklogCreate?.({
          description: 'Oppdaterte vendor type registry',
          loggedAt: timestamp
        });
        break;
      case 'typeSpecificTemplates':
        onFileDownload?.({
          projectId: projectContext.id,
          fileName: 'templates.zip',
          generatedAt: timestamp
        });
        onWorklogCreate?.({
          projectId: projectContext.id,
          description: 'Lastet ned type-malpakke',
          loggedAt: timestamp
        });
        break;
      case 'realTimeMarketplaceSync':
        onProjectUpdate?.({
          ...projectContext,
          status: 'syncing',
          updatedAt: timestamp
        });
        break;
      case 'dynamicPricing':
        onProjectUpdate?.({
          ...projectContext,
          status: 'pricing',
          updatedAt: timestamp
        });
        onWorklogCreate?.({
          projectId: projectContext.id,
          description: 'Prisoptimalisering startet',
          loggedAt: timestamp
        });
        break;
      case 'orderFulfillment':
      case 'orderProcessing':
        onClientUpdate?.({
          ...clientContext,
          lastOrderUpdate: timestamp
        });
        onProjectUpdate?.({
          ...projectContext,
          status: 'fulfillment',
          updatedAt: timestamp
        });
        onFileDownload?.({
          projectId: projectContext.id,
          fileName: 'packing-slip.pdf',
          generatedAt: timestamp
        });
        break;
      case 'digitalDelivery':
        onFileUpload?.({
          projectId: projectContext.id,
          fileName: 'digital-assets.zip',
          uploadedAt: timestamp
        });
        onFileDownload?.({
          projectId: projectContext.id,
          fileName: 'download-links.json',
          generatedAt: timestamp
        });
        break;
      case 'subscriptionManagement':
        onClientUpdate?.({
          ...clientContext,
          subscriptionStatus: 'active',
          lastUpdated: timestamp
        });
        onProjectUpdate?.({
          ...projectContext,
          status: 'subscription',
          updatedAt: timestamp
        });
        break;
      case 'inventoryManagement':
        onWorklogCreate?.({
          projectId: projectContext.id,
          description: 'Inventory scan kjort',
          loggedAt: timestamp
        });
        break;
      case 'vendorOnboardingProgress':
      case 'quickStatsRefresh':
      case 'orderFulfillmentAlert':
        onWorklogCreate?.({
          projectId: projectContext.id,
          description: `Oppdaterte workflow: ${orchestrationId}`,
          loggedAt: timestamp
        });
        break;
      default:
        break;
    }

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

  const getMetricIcon = (metric: any) => {
    switch (metric.type) {
      case 'performance':
        return <Speed sx={{ color: getMetricColor(metric) }} />;
      case 'storage':
        return <Storage sx={{ color: getMetricColor(metric) }} />;
      case 'network':
        return <Cloud sx={{ color: getMetricColor(metric) }} />;
      case 'orders':
        return <ShoppingCart sx={{ color: getMetricColor(metric) }} />;
      case 'inventory':
        return <Inventory sx={{ color: getMetricColor(metric) }} />;
      default:
        return <Memory sx={{ color: getMetricColor(metric) }} />;
    }
  };

  const getOrchestrationStatusColor = (orchestrationKey: string) => {
    const state = orchestrationStates[orchestrationKey] || orchestrationStatus[orchestrationKey];
    if (state?.running) return '#4caf50'; // Green
    const orchestration = VENDOR_ORCHESTRATIONS[orchestrationKey as keyof typeof VENDOR_ORCHESTRATIONS];
    if (orchestration?.status === 'active') return '#ff5722'; // Orange-red
    return '#757575'; // Gray
};

  const resolvedMetrics = SYSTEM_METRICS.map((metric) => {
    const liveMetric = Array.isArray(systemMetrics)
      ? systemMetrics.find((item: any) => item?.name === metric.name)
      : systemMetrics?.[metric.name] || systemMetrics?.[metric.type];
    const rawValue = Number(liveMetric?.value ?? metric.value);
    return {
      ...metric,
      value: Number.isFinite(rawValue) ? rawValue : metric.value
    };
  });
  const performanceMetric = resolvedMetrics.find((metric) => metric.type === 'performance');
  const inventoryMetric = resolvedMetrics.find((metric) => metric.type === 'inventory');
  const userDisplayName = user?.name || user?.email || 'Bruker';

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
            {professionDisplayName} Orkestrering
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Automatisk sammenkobling av leverandør og lager komponenter
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Tooltip title={showSystemMetrics ? 'Skjul system metrics' : 'Vis system metrics'}>
            <IconButton
              onClick={() => setShowSystemMetrics(prev => !prev)}
              sx={{ bgcolor: '#f5f5f5' }}
              aria-label={showSystemMetrics ? 'Skjul system metrics' : 'Vis system metrics'}
            >
              {showSystemMetrics ? <VisibilityOff /> : <Visibility />}
            </IconButton>
          </Tooltip>
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

      <Divider sx={{ mb: 3 }} />

      {/* Kontekst og raske kontroller */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <People sx={{ color: theming.colors.primary }} />
                <Typography variant="h6">Vendor kontekst</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Innlogget: {userDisplayName}
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" sx={{ mb: 1 }}>
                Prosjekt: {selectedProject?.name || 'Ikke valgt'}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Kunde: {selectedClient?.name || 'Ikke valgt'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Business />}
                  onClick={() => onProjectSelect?.({
                    id: `vendor-${Date.now()}`,
                    name: 'Demo vendor prosjekt'
                  })}
                >
                  Velg prosjekt
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<People />}
                  onClick={() => onClientSelect?.({
                    id: `customer-${Date.now()}`,
                    name: 'Demo kunde'
                  })}
                >
                  Velg kunde
                </Button>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>
        <Grid item xs={12} md={4}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Settings sx={{ color: theming.colors.primary }} />
                <Typography variant="h6">Vendor typer</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Aktive typer: {enabledVendorTypes.length} / {allVendorTypes.length}
              </Typography>
              {configLoading && <LinearProgress sx={{ my: 2 }} />}
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" sx={{ mb: 1 }}>
                Prosjekttyper
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {projectTypes.length === 0 && (
                  <Chip size="small" label="Ingen typer" />
                )}
                {projectTypes.map((type: string) => (
                  <Chip key={type} size="small" label={type} color="primary" />
                ))}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                <AutoAwesome sx={{ color: theming.colors.primary }} />
                <Typography variant="caption" color="text.secondary">
                  {professionConfig?.specialFeatures?.length || 0} spesialfunksjoner aktivert
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <TimelineIcon sx={{ color: theming.colors.primary }} />
                <Typography variant="caption" color="text.secondary">
                  {Object.keys(VENDOR_ORCHESTRATIONS).length} workflows aktive
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <TrendingUp sx={{ color: theming.colors.primary }} />
                <Typography variant="caption" color="text.secondary">
                  Performance: {performanceMetric?.value ?? 0}{performanceMetric?.unit || ''}
                </Typography>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>
        <Grid item xs={12} md={4}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Build sx={{ color: theming.colors.primary }} />
                <Typography variant="h6">Hurtigverktøy</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<PlayCircle />}
                  onClick={() => onWorklogCreate?.({
                    projectId: selectedProject?.id,
                    description: 'Startet ny order flow',
                    loggedAt: new Date().toISOString()
                  })}
                >
                  Start
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Pause />}
                  onClick={() => onWorklogCreate?.({
                    projectId: selectedProject?.id,
                    description: 'Satte vendor flow pa pause',
                    loggedAt: new Date().toISOString()
                  })}
                >
                  Pause
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={() => handleOrchestrationTrigger(selectedOrchestration)}
                >
                  Oppdater
                </Button>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircle sx={{ color: '#4caf50' }} />
                  <Typography variant="caption">Automatisering klar</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Warning sx={{ color: '#ff9800' }} />
                  <Typography variant="caption">Ordre queue overvaket</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Info sx={{ color: '#2196f3' }} />
                  <Typography variant="caption">Marketplace sync aktiv</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Error sx={{ color: '#f44336' }} />
                  <Typography variant="caption">Ingen kritiske feil</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Security sx={{ color: '#607d8b' }} />
                  <Typography variant="caption">Sikkerhetsstatus OK</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                <Sync sx={{ color: theming.colors.primary }} />
                <Typography variant="caption" color="text.secondary">
                  Lager: {inventoryMetric?.value ?? 0}{inventoryMetric?.unit || ''} varer overvaket
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <LocalShipping sx={{ color: theming.colors.primary }} />
                <Typography variant="caption" color="text.secondary">
                  Levering og fulfilment integrert
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <Payment sx={{ color: theming.colors.primary }} />
                <Typography variant="caption" color="text.secondary">
                  Betaling og abonnement aktiv
                </Typography>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>
      </Grid>

	      {/* System Metrics (når aktivert) */}
	      {showSystemMetrics && (
	        <Grid container spacing={2} sx={{ mb: 4 }}>
            {resolvedMetrics.map((metric, index) => (
              <Grid item xs={6} md={2} key={index}>
	              <MuiCard
	                sx={{
	                  border: `2px solid ${getMetricColor(metric)}20`, '&:hover': {
	                    borderColor: getMetricColor(metric),
	                  }}}
	              >
	                <CardContent sx={{ textAlign: 'center', py: 1, ...theming.getThemedCardSx() }}>
                    <Box sx={{ mb: 1 }}>
                      {getMetricIcon(metric)}
                    </Box>
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
            placeholder='{"productId" : "12345", "quantity": 5}'
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
          {selectedOrchestration && VENDOR_ORCHESTRATIONS[selectedOrchestration as keyof typeof VENDOR_ORCHESTRATIONS]?.name} - Detaljer
        </DialogTitle>
        <DialogContent>
          {selectedOrchestration && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Trigger: </Typography>
              <Chip 
                label={VENDOR_ORCHESTRATIONS[selectedOrchestration as keyof typeof VENDOR_ORCHESTRATIONS].trigger}
                color="primary"
                sx={{ mb: 2 }}
              />
              
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Automatiserte Aksjoner: </Typography>
              <List>
                {VENDOR_ORCHESTRATIONS[selectedOrchestration as keyof typeof VENDOR_ORCHESTRATIONS].actions.map((action, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <Link color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={action.component}
                      secondary={`${action.action}${action.dependsOn ? ` (avhenger av: ${action.dependsOn})` : ''}`}
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