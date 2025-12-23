/**
 * React Hook for file status indicators
 * Provides easy access to status indicators and wrapper components
 */

import { useFileManagementStatus } from '../contexts/FileManagementStatusContext';
import { FileStatusWrapper, FileStatusBadge } from '../components/common/FileStatusIndicators';

export function useFileStatusIndicators() {
  const { status, updateStatus, testFileSystem, testGoogleDrive, testGooglePhotos } = useFileManagementStatus();

  const getStatusColor = (service: 'system' | 'googleDrive' | 'googlePhotos') => {
    switch (service) {
      case 'system':
        return status.systemStatus === 'connected' ? '#4caf50' : '#f44336';
      case 'googleDrive':
        return status.googleDriveStatus === 'connected' ? '#4caf50' : '#f44336';
      case 'googlePhotos':
        return status.googlePhotosStatus === 'connected' ? '#4caf50' : '#f44336';
      default:
        return '#9e9e9e';
}
};

  const getStatusText = (service: 'system' | 'googleDrive' | 'googlePhotos') => {
    switch (service) {
      case 'system':
        return `File System: ${status.systemStatus === 'connected' ? 'Healthy' : 'Unhealthy'}`;
      case 'googleDrive':
        return `Google Drive: ${status.googleDriveResponse || 'Not tested'}`;
      case 'googlePhotos':
        return `Google Photos: ${status.googlePhotosResponse || 'Not tested'}`;
      default: return 'Unknown status';
}
};

  const isHealthy = () => {
    return status.systemStatus === 'connected' && 
           status.googleDriveStatus === 'connected' && 
           status.googlePhotosStatus === 'connected';
};

  const hasAnyIssues = () => {
    return status.systemStatus !== 'connected' || 
           status.googleDriveStatus !== 'connected' || 
           status.googlePhotosStatus !== 'connected';
};

  const getOverallStatus = () => {
    if (isHealthy()) return 'healthy';
    if (hasAnyIssues()) return 'issues';
    return 'unknown';
};

  const renderStatusWrapper = (children: React.ReactNode, options?: {
    showFileSystem?: boolean;
    showGoogleDrive?: boolean;
    showGooglePhotos?: boolean;
    size?: 'small' | 'medium' | 'large';
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}) => {
    return (
      <FileStatusWrapper
        showFileSystem={options?.showFileSystem ?? true}
        showGoogleDrive={options?.showGoogleDrive ?? false}
        showGooglePhotos={options?.showGooglePhotos ?? false}
        size={options?.size ?? 'small'}
        position={options?.position ?? 'top-right'}
      >
        {children}
      </FileStatusWrapper>
    );
};

  const renderStatusBadge = (variant?: 'dot' | 'chip' | 'badge', showAll?: boolean, compact?: boolean) => {
    return (
      <FileStatusBadge
        variant={variant}
        showAll={showAll}
        compact={compact}
      />
    );
};

  return {
    // Status data
    status,
    isHealthy: isHealthy(),
    hasIssues: hasAnyIssues(),
    overallStatus: getOverallStatus(),
    
    // Helper functions
    getStatusColor,
    getStatusText,
    
    // Actions
    updateStatus,
    testFileSystem,
    testGoogleDrive,
    testGooglePhotos,
    
    // Render helpers
    renderStatusWrapper,
    renderStatusBadge,
    
    // Quick status checks
    isSystemHealthy: status.systemStatus === 'connected',
    isGoogleDriveHealthy: status.googleDriveStatus === 'connected',
    isGooglePhotosHealthy: status.googlePhotosStatus ==='connected',
    
    // Status messages
    systemMessage: getStatusText('system'),
    googleDriveMessage: getStatusText('googleDrive'),
    googlePhotosMessage: getStatusText('googlePhotos'),
};
}



