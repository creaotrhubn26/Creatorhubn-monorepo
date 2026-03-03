import { apiRequest } from './queryClient';

type JsonRecord = Record<string, unknown>;

const toQueryString = (params?: JsonRecord): string => {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query.length > 0 ? `?${query}` : '';
};

// Unified API client for admin components
export class AdminAPIClient {
  // Feature Management
  async getFeatures() {
    return apiRequest('/api/admin/features');
  }

  async updateFeature(id: string, updates: JsonRecord) {
    return apiRequest(`/api/admin/features/${id}`, {
      method: 'PATCH',
      body: updates,
    });
  }

  async publishFeatures(environment: 'staging' | 'production', data: JsonRecord) {
    return apiRequest(`/api/feature-flags/publish/${environment}`, {
      method: 'POST',
      body: data,
    });
  }

  async revertFeatures(environment: 'staging' | 'production', data: JsonRecord) {
    return apiRequest(`/api/feature-flags/revert/${environment}`, {
      method: 'POST',
      body: data,
    });
  }

  // User Management
  async getUsers() {
    return apiRequest('/api/admin-provisioning/users');
  }

  async createUser(userData: JsonRecord) {
    return apiRequest('/api/admin-provisioning/create-user', {
      method: 'POST',
      body: userData,
    });
  }

  async updateUser(id: string, updates: JsonRecord) {
    return apiRequest(`/api/admin-provisioning/users/${id}`, {
      method: 'PATCH',
      body: updates,
    });
  }

  async approveUser(userId: string, userType: string, enableIntegrations: boolean) {
    return apiRequest('/api/admin-provisioning/approve-music-producer', {
      method: 'POST',
      body: { userId, userType, enableIntegrations },
    });
  }

  async rejectUser(userId: string, reason: string) {
    return apiRequest('/api/admin-provisioning/reject-user', {
      method: 'POST',
      body: { userId, reason },
    });
  }

  // Profession Type Management
  async getProfessionTypes() {
    return apiRequest('/api/admin/profession-types');
  }

  async createProfessionType(data: JsonRecord) {
    return apiRequest('/api/admin/profession-types', {
      method: 'POST',
      body: data,
    });
  }

  async updateProfessionType(id: string, updates: JsonRecord) {
    return apiRequest(`/api/admin/profession-types/${id}`, {
      method: 'PATCH',
      body: updates,
    });
  }

  async deleteProfessionType(id: string) {
    return apiRequest(`/api/admin/profession-types/${id}`, {
      method: 'DELETE',
    });
  }

  // Profession Type Deployment
  async createProfessionTypeFeatureFlags(id: string) {
    return apiRequest(`/api/admin/profession-types/${id}/create-feature-flags`, {
      method: 'POST',
    });
  }

  async deployProfessionTypeComponents(id: string) {
    return apiRequest(`/api/admin/profession-types/${id}/deploy-components`, {
      method: 'POST',
    });
  }

  async updateProfessionTypePermissions(id: string) {
    return apiRequest(`/api/admin/profession-types/${id}/update-permissions`, {
      method: 'POST',
    });
  }

  async configureProfessionTypeIntegrations(id: string) {
    return apiRequest(`/api/admin/profession-types/${id}/configure-integrations`, {
      method: 'POST',
    });
  }

  async setupProfessionTypeAnalytics(id: string) {
    return apiRequest(`/api/admin/profession-types/${id}/setup-analytics`, {
      method: 'POST',
    });
  }

  // Product Management
  async getProducts(params?: JsonRecord) {
    return apiRequest(`/api/admin/products${toQueryString(params)}`);
  }

  async createProduct(data: JsonRecord) {
    return apiRequest('/api/admin/products', {
      method: 'POST',
      body: data,
    });
  }

  async updateProduct(id: string, updates: JsonRecord) {
    return apiRequest(`/api/admin/products/${id}`, {
      method: 'PUT',
      body: updates,
    });
  }

  async deleteProduct(id: string) {
    return apiRequest(`/api/admin/products/${id}`, {
      method: 'DELETE',
    });
  }

  // Vendor Type Management
  async getVendorTypes() {
    return apiRequest('/api/vendor-types');
  }

  async createVendorType(data: JsonRecord) {
    return apiRequest('/api/vendor-types', {
      method: 'POST',
      body: data,
    });
  }

  async updateVendorType(id: string, updates: JsonRecord) {
    return apiRequest(`/api/vendor-types/${id}`, {
      method: 'PATCH',
      body: updates,
    });
  }

  async deleteVendorType(id: string) {
    return apiRequest(`/api/vendor-types/${id}`, {
      method: 'DELETE',
    });
  }

  // Vendor Type Deployment
  async createVendorTypeFeatureFlags(id: string) {
    return apiRequest(`/api/vendor-types/${id}/create-feature-flags`, {
      method: 'POST',
    });
  }

  async deployVendorTypeComponents(id: string) {
    return apiRequest(`/api/vendor-types/${id}/deploy-components`, {
      method: 'POST',
    });
  }

  async updateVendorTypeBilling(id: string) {
    return apiRequest(`/api/vendor-types/${id}/update-billing`, {
      method: 'POST',
    });
  }

  async configureVendorTypeIntegrations(id: string) {
    return apiRequest(`/api/vendor-types/${id}/configure-integrations`, {
      method: 'POST',
    });
  }

  async setupVendorTypeAnalytics(id: string) {
    return apiRequest(`/api/vendor-types/${id}/setup-analytics`, {
      method: 'POST',
    });
  }

  // Analytics
  async getUnifiedAnalytics() {
    return apiRequest('/api/admin/analytics/unified');
  }

  async getFeatureAnalytics() {
    return apiRequest('/api/admin/analytics/features');
  }

  async getUserAnalytics() {
    return apiRequest('/api/admin/analytics/users');
  }

  async getProductAnalytics() {
    return apiRequest('/api/admin/analytics/products');
  }

  async getProfessionTypeAnalytics() {
    return apiRequest('/api/admin/analytics/profession-types');
  }

  async getVendorTypeAnalytics() {
    return apiRequest('/api/admin/analytics/vendor-types');
  }

  // Analytics Tracking
  async trackEvent(event: {
    action: string;
    component: string;
    targetId?: string;
    metadata?: JsonRecord;
  }) {
    return apiRequest('/api/admin/analytics/track', {
      method: 'POST',
      body: {
        ...event,
        timestamp: Date.now(),
      },
    });
  }

  // Bulk Operations
  async bulkUpdateFeatures(updates: Array<{ id: string; updates: JsonRecord }>) {
    return apiRequest('/api/admin/features/bulk-update', {
      method: 'POST',
      body: { updates },
    });
  }

  async bulkCreateUsers(users: JsonRecord[]) {
    return apiRequest('/api/admin-provisioning/bulk-create-users', {
      method: 'POST',
      body: { users },
    });
  }

  async bulkUpdateProfessionTypes(updates: Array<{ id: string; updates: JsonRecord }>) {
    return apiRequest('/api/admin/profession-types/bulk-update', {
      method: 'POST',
      body: { updates },
    });
  }

  // System Operations
  async getSystemHealth() {
    return apiRequest('/api/admin/system/health');
  }

  async getSystemMetrics() {
    return apiRequest('/api/admin/system/metrics');
  }

  async triggerSystemRefresh() {
    return apiRequest('/api/admin/system/refresh', {
      method: 'POST',
    });
  }

  // Audit Logs
  async getAuditLogs(params?: JsonRecord) {
    return apiRequest(`/api/admin/audit/logs${toQueryString(params)}`);
  }

  async getAuditLog(id: string) {
    return apiRequest(`/api/admin/audit/logs/${id}`);
  }

  // Notifications
  async getNotifications() {
    return apiRequest('/api/admin/notifications');
  }

  async markNotificationAsRead(id: string) {
    return apiRequest(`/api/admin/notifications/${id}/read`, {
      method: 'PATCH',
    });
  }

  async markAllNotificationsAsRead() {
    return apiRequest('/api/admin/notifications/read-all', {
      method: 'PATCH',
    });
  }

  // Settings
  async getSettings() {
    return apiRequest('/api/admin/settings');
  }

  async updateSettings(settings: JsonRecord) {
    return apiRequest('/api/admin/settings', {
      method: 'PATCH',
      body: settings,
    });
  }

  // Export/Import
  async exportData(type: 'features' | 'users' | 'profession-types' | 'products', format: 'json' | 'csv') {
    return apiRequest(`/api/admin/export/${type}?format=${format}`);
  }

  async importData(type: 'features' | 'users' | 'profession-types' | 'products', file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest(`/api/admin/import/${type}`, {
      method: 'POST',
      body: formData,
    });
  }
}

// Create singleton instance
export const adminAPI = new AdminAPIClient();

// Export individual methods for convenience
export const {
  getFeatures,
  updateFeature,
  publishFeatures,
  revertFeatures,
  getUsers,
  createUser,
  updateUser,
  approveUser,
  rejectUser,
  getProfessionTypes,
  createProfessionType,
  updateProfessionType,
  deleteProfessionType,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getVendorTypes,
  createVendorType,
  updateVendorType,
  deleteVendorType,
  getUnifiedAnalytics,
  trackEvent,
  getSystemHealth,
  getSystemMetrics,
  triggerSystemRefresh,
  getAuditLogs,
  getAuditLog,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getSettings,
  updateSettings,
  exportData,
  importData,
} = adminAPI;

export default adminAPI;
