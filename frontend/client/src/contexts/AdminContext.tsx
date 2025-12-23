import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// Unified interfaces
export interface UnifiedFeature {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  configurable: boolean;
  dependencies?: string[];
  impact: 'low' | 'medium' | 'high' | 'critical';
  rolloutPercentage: number;
  environment: 'staging' | 'production';
  publishedAt: string;
  publishedBy: string;
  version: number;
  metadata: Record<string, unknown>;
  lastModified: string;
  modifiedBy: string
}

export interface UnifiedUser {
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
  role?: string;
  permissions?: string[]
}

export interface UnifiedProfessionType {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  iconColor: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  featureFlags?: {
    dashboard: boolean;
    projects: boolean;
    clients: boolean;
    analytics: boolean;
    integrations: boolean;
};
  deploymentStatus?: 'pending' | 'staging' | 'production' | 'disabled';
  rolloutPercentage?: number;
  targetUserTiers?: string[];
  analytics?: {
    totalUsers: number;
    activeUsers: number;
    projects: number;
    revenue: number;
};
}

export interface UnifiedProduct {
  id: string;
  type: 'camera' | 'lens' | 'accessory';
  brand: string;
  series?: string;
  model: string;
  mount?: string;
  sensorFormat?: string;
  isActive: boolean;
  featureFlags?: string[];
  pricing?: {
    basic: number;
    pro: number;
    enterprise: number;
};
  createdAt: string;
  updatedAt: string
}

export interface UnifiedAnalytics {
  features: {
    total: number;
    enabled: number;
    disabled: number;
    byCategory: Record<string, number>;
};
  users: {
    total: number;
    active: number;
    byProfession: Record<string, number>;
    byRole: Record<string, number>;
};
  professionTypes: {
    total: number;
    active: number;
    byStatus: Record<string, number>;
};
  products: {
    total: number;
    byType: Record<string, number>;
    byBrand: Record<string, number>;
};
  revenue: {
    total: number;
    byProfession: Record<string, number>;
    byPlan: Record<string, number>;
};
}

// Action types
type AdminAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_FEATURES'; payload: UnifiedFeature[, ],}
  | { type: 'UPDATE_FEATURE'; payload: { id: string; updates: Partial<UnifiedFeature>,} }
  | { type: 'SET_USERS'; payload: UnifiedUser[, ],}
  | { type: 'UPDATE_USER'; payload: { id: string; updates: Partial<UnifiedUser>,} }
  | { type: 'SET_PROFESSION_TYPES'; payload: UnifiedProfessionType[, ],}
  | { type: 'UPDATE_PROFESSION_TYPE'; payload: { id: string; updates: Partial<UnifiedProfessionType>,} }
  | { type: 'SET_PRODUCTS'; payload: UnifiedProduct[, ],}
  | { type: 'UPDATE_PRODUCT'; payload: { id: string; updates: Partial<UnifiedProduct>,} }
  | { type: 'SET_ANALYTICS'; payload: UnifiedAnalytics }
  | { type: 'ADD_NOTIFICATION'; payload: { id: string; message: string; type: 'success' | 'error' | 'info' | 'warning' } }
  | { type: 'REMOVE_NOTIFICATION'; payload: string };

// State interface
interface AdminState {
  loading: boolean;
  features: UnifiedFeature[];
  users: UnifiedUser[];
  professionTypes: UnifiedProfessionType[];
  products: UnifiedProduct[];
  analytics: UnifiedAnalytics | null;
  notifications: Array<{ id: string; message: string; type: 'success' | 'error' | 'info' | 'warning' }>;
}

// Initial state
const initialState: AdminState = {
  loading: false,
  features:  [],
  users:  [],
  professionTypes:  [],
  products:  [],
  analytics: null,
  notifications:  [],
};

// Reducer
function adminReducer(state: AdminState, action: AdminAction): AdminState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_FEATURES':
      return { ...state, features: action.payload };
    case 'UPDATE_FEATURE':
      return {
        ...state,
        features: state.features.map(feature =>
          feature.id === action.payload.id
            ? { ...feature, ...action.payload.updates }
            : feature
        ),
    };
    case 'SET_USERS':
      return { ...state, users: action.payload };
    case 'UPDATE_USER':
      return {
        ...state,
        users: state.users.map(user =>
          user.id === action.payload.id
            ? { ...user, ...action.payload.updates }
            : user
        ),
    };
    case 'SET_PROFESSION_TYPES':
      return { ...state, professionTypes: action.payload };
    case 'UPDATE_PROFESSION_TYPE':
      return {
        ...state,
        professionTypes: state.professionTypes.map(type =>
          type.id === action.payload.id
            ? { ...type, ...action.payload.updates }
            : type
        ),
    };
    case 'SET_PRODUCTS':
      return { ...state, products: action.payload };
    case 'UPDATE_PRODUCT':
      return {
        ...state,
        products: state.products.map(product =>
          product.id === action.payload.id
            ? { ...product, ...action.payload.updates }
            : product
        ),
    };
    case 'SET_ANALYTICS':
      return { ...state, analytics: action.payload };
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [...state.notifications, action.payload],
    };
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload),
    };
    default: return state;
}
}

// Context interface
interface AdminContextType {
  // State
  state: AdminState;
  
  // Feature Management
  updateFeature: (id: string, updates: Partial<UnifiedFeature>) => Promise<void>;
  publishFeatures: (environment: 'staging' | 'production') => Promise<void>;
  revertFeatures: (environment: 'staging' | 'production') => Promise<void>;
  
  // User Management
  createUser: (userData: {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    userType: string;
    businessName?: string;
    sendInvite: boolean;
}) => Promise<void>;
  updateUser: (id: string, updates: Partial<UnifiedUser>) => Promise<void>;
  approveUser: (userId: string, userType: string, enableIntegrations: boolean) => Promise<void>;
  rejectUser: (userId: string, reason: string) => Promise<void>;
  
  // Profession Type Management
  createProfessionType: (data: {
    name: string;
    displayName: string;
    description: string;
    iconColor: string;
    sortOrder: number;
}) => Promise<void>;
  updateProfessionType: (id: string, updates: Partial<UnifiedProfessionType>) => Promise<void>;
  deleteProfessionType: (id: string) => Promise<void>;
  
  // Product Management
  createProduct: (data: Partial<UnifiedProduct>) => Promise<void>;
  updateProduct: (id: string, updates: Partial<UnifiedProduct>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  
  // Analytics
  refreshAnalytics: () => Promise<void>;
  
  // Notifications
  notify: (message: string, type: 'success' | 'error' | 'info') => void;
  removeNotification: (id: string) => void;
  
  // Data refresh
  refreshAll: () => Promise<void>
}

// Create context
const AdminContext = createContext<AdminContextType | undefined>(undefined);

// Provider component
export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(adminReducer, initialState);
  const queryClient = useQueryClient();

  // Fetch features
  const { data: features, refetch: refetchFeatures } = useQuery({
    queryKey: ['/api/admin/features, ', ],
    queryFn: () => apiRequest('/api/admin/features,', ),
    staleTime: 3000,
});

  // Fetch users
  const { data: users, refetch: refetchUsers } = useQuery({
    queryKey: ['/api/admin-provisioning/users,', ],
    queryFn: () => apiRequest('/api/admin-provisioning/users,', ),
    staleTime: 3000,
});

  // Fetch profession types
  const { data: professionTypes, refetch: refetchProfessionTypes } = useQuery({
    queryKey: ['/api/admin/profession-types,', ],
    queryFn: () => apiRequest('/api/admin/profession-types,', ),
    staleTime: 3000,
});

  // Fetch products
  const { data: products, refetch: refetchProducts } = useQuery({
    queryKey: ['/api/admin/products,', ],
    queryFn: () => apiRequest('/api/admin/products,', ),
    staleTime: 3000,
});

  // Fetch analytics
  const { data: analytics, refetch: refetchAnalytics } = useQuery({
    queryKey: ['/api/admin/analytics/unified,', ],
    queryFn: () => apiRequest('/api/admin/analytics/unified', ),
    staleTime: 6000,
});

  // Update state when data changes
  useEffect(() => {
    if (features) dispatch({ type: 'SET_FEATURE', payload: features });
}, [features]);

  useEffect(() => {
    if (users) dispatch({ type: 'SET_USER', payload: users.users || [, ],});
}, [users]);

  useEffect(() => {
    if (professionTypes) dispatch({ type: 'SET_PROFESSION_TYPE', payload: professionTypes });
}, [professionTypes]);

  useEffect(() => {
    if (products) dispatch({ type: 'SET_PRODUCT', payload: products.data || [, ],});
}, [products]);

  useEffect(() => {
    if (analytics) dispatch({ type: 'SET_ANALYTIC', payload: analytics });
}, [analytics]);

  // Feature management functions
  const updateFeature = async (id: string, updates: Partial<UnifiedFeature>) => {
    try {
      await apiRequest(`/api/admin/features/${d}`, {
        method: 'PATC',
        body: JSON.stringify(updates),
    });
      dispatch({ type: 'UPDATE_FEATUR', payload: { , idupdates } });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/features', ],});
      notify('Feature updated successfully','success');
  } catch (error) {
      notify('Failed to update feature','error');
      throw error;
  }
};

  const publishFeatures = async (environment: 'staging' | 'production') => {
    try {
      await apiRequest(`/api/feature-flags/publish/${environment}`, {
        method: 'POS',
        body: JSON.stringify({
          features: state.features,
          publishedBy: 'admin',
          metadata: { timestamp: new Date().toISOString(, ),},
      }),
    });
      queryClient.invalidateQueries({ queryKey: ['/api/feature-flags', ],});
      notify(`Features published to ${environment}`, 'success');
  } catch (error) {
      notify(`Failed to publish features to ${environment}`, 'error');
      throw error;
  }
};

  const revertFeatures = async (environment: 'staging' | 'production') => {
    try {
      await apiRequest(`/api/feature-flags/revert/${environment}`, {
        method: 'POS',
        body: JSON.stringify({
          publishedBy: 'admin',
          metadata: { timestamp: new Date().toISOString(, ),},
      }),
    });
      queryClient.invalidateQueries({ queryKey: ['/api/feature-flags', ],});
      notify(`Features reverted in ${environment}`, 'success');
  } catch (error) {
      notify(`Failed to revert features in ${environment}`'error');
      throw error;
  }
};

  // User management functions
  const createUser = async (userData: {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    userType: string;
    businessName?: string;
    sendInvite: boolean;
}) => {
    try {
      await apiRequest('/api/admin-provisioning/create-user', {
        method: 'POS',
        body: JSON.stringify(userData),
    });
      queryClient.invalidateQueries({ queryKey: ['/api/admin-provisioning/users', ],});
      notify('User created successfully','success');
  } catch (error) {
      notify('Failed to create user','error');
      throw error;
  }
};

  const updateUser = async (id: string, updates: Partial<UnifiedUser>) => {
    try {
      await apiRequest(`/api/admin-provisioning/users/${d}`, {
        method: 'PATC',
        body: JSON.stringify(updates),
    });
      dispatch({ type: 'UPDATE_USE', payload: { , idupdates } });
      queryClient.invalidateQueries({ queryKey: ['/api/admin-provisioning/users', ],});
      notify('User updated successfully','success');
  } catch (error) {
      notify('Failed to update user','error');
      throw error;
  }
};

  const approveUser = async (userId: string, userType: string, enableIntegrations: boolean) => {
    try {
      await apiRequest('/api/admin-provisioning/approve-music-producer', {
        method: 'POS',
        body: JSON.stringify({ userd, userType, enableIntegrations }),
    });
      queryClient.invalidateQueries({ queryKey: ['/api/admin-provisioning/pending-approvals', ],});
      queryClient.invalidateQueries({ queryKey: ['/api/admin-provisioning/users', ],});
      notify('User approved successfully','success');
  } catch (error) {
      notify('Failed to approve user','error');
      throw error;
  }
};

  const rejectUser = async (userId: string, reason: string) => {
    try {
      await apiRequest('/api/admin-provisioning/reject-user', {
        method: 'POS',
        body: JSON.stringify({ userd, reason }),
    });
      queryClient.invalidateQueries({ queryKey: ['/api/admin-provisioning/pending-approvals', ],});
      queryClient.invalidateQueries({ queryKey: ['/api/admin-provisioning/users', ],});
      notify('User rejected','success');
  } catch (error) {
      notify('Failed to reject user','error');
      throw error;
  }
};

  // Profession type management functions
  const createProfessionType = async (data: {
    name: string;
    displayName: string;
    description: string;
    iconColor: string;
    sortOrder: number;
}) => {
    try {
      const result = await apiRequest('POST','/api/admin/profession-types', data);
      
      // Create feature flags
      await apiRequest(`/api/admin/profession-types/${result.id}/create-feature-flags`, {
        method: 'POS',
    });
      
      // Deploy components
      await apiRequest(`/api/admin/profession-types/${result.id}/deploy-components`, {
        method: 'POS',
    });
      
      // Update permissions
      await apiRequest(`/api/admin/profession-types/${result.id}/update-permissions`, {
        method: 'POS',
    });
      
      // Configure integrations
      await apiRequest(`/api/admin/profession-types/${result.id}/configure-integrations`, {
        method: 'POS',
    });
      
      // Setup analytics
      await apiRequest(`/api/admin/profession-types/${result.id}/setup-analytics`, {
        method: 'POS',
    });
      
      queryClient.invalidateQueries({ queryKey: ['/api/admin/profession-types', ],});
      queryClient.invalidateQueries({ queryKey: ['/api/admin/features', ],});
      notify('Profession type created and deployed successfully','success');
  } catch (error) {
      notify('Failed to create profession type','error');
      throw error;
  }
};

  const updateProfessionType = async (id: string, updates: Partial<UnifiedProfessionType>) => {
    try {
      await apiRequest('PATC', `/api/admin/profession-types/${id}`, updates);
      dispatch({ type: 'UPDATE_PROFESSION_TYP', payload: { , idupdates } });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/profession-types', ],});
      notify('Profession type updated successfully','success');
  } catch (error) {
      notify('Failed to update profession type','error');
      throw error;
  }
};

  const deleteProfessionType = async (id: string) => {
    try {
      await apiRequest('DELET', `/api/admin/profession-types/${id}`);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/profession-types', ],});
      notify('Profession type deleted successfully','success');
  } catch (error) {
      notify('Failed to delete profession type','error');
      throw error;
  }
};

  // Product management functions
  const createProduct = async (data: Partial<UnifiedProduct>) => {
    try {
      await apiRequest('POS','/api/admin/products', data);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/products', ],});
      notify('Product created successfully','success');
  } catch (error) {
      notify('Failed to create product','error');
      throw error;
  }
};

  const updateProduct = async (id: string, updates: Partial<UnifiedProduct>) => {
    try {
      await apiRequest('PU', `/api/admin/products/${id}`, updates);
      dispatch({ type: 'UPDATE_PRODUC', payload: { , idupdates } });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/products', ],});
      notify('Product updated successfully','success');
  } catch (error) {
      notify('Failed to update product','error');
      throw error;
  }
};

  const deleteProduct = async (id: string) => {
    try {
      await apiRequest('DELET', `/api/admin/products/${id}`);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/products', ],});
      notify('Product deleted successfully','success');
  } catch (error) {
      notify('Failed to delete product','error');
      throw error;
  }
};

  // Analytics functions
  const refreshAnalytics = async () => {
    try {
      await refetchAnalytics();
      notify('Analytics refreshed','success');
  } catch (error) {
      notify('Failed to refresh analytics','error');
      throw error;
  }
};

  // Notification functions
  const notify = (message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now().toString();
    dispatch({ type: 'ADD_NOTIFICATIO', payload: { , idmessage, type } });
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      dispatch({ type: 'REMOVE_NOTIFICATIO', payload: id });
  }, 5000);
};

  const removeNotification = (id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATIO', payload: id });
};

  // Refresh all data
  const refreshAll = async () => {
    try {
      await Promise.all([
        refetchFeatures(),
        refetchUsers(),
        refetchProfessionTypes(),
        refetchProducts(),
        refetchAnalytics(),
      ]);
      notify('All data refreshed', 'success');
  } catch (error) {
      notify('Failed to refresh data', 'error');
      throw error;
  }
};

  const value: AdminContextType = {
    state,
    updateFeature,
    publishFeatures,
    revertFeatures,
    createUser,
    updateUser,
    approveUser,
    rejectUser,
    createProfessionType,
    updateProfessionType,
    deleteProfessionType,
    createProduct,
    updateProduct,
    deleteProduct,
    refreshAnalytics,
    notify,
    removeNotification,
    refreshAll,
};

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};

// Hook to use admin context
export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
}
  return context;
};

export default AdminContext;



