/**
 * FileUploadSyncService - Broadcasts file upload events and triggers showcase refresh
 */

import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';

export const useFileUploadSync = () => {
  const { communication } = useEnhancedMasterIntegration();

  const broadcastUpload = (payload: {
    fileId?: string;
    fileName?: string;
    projectId?: string;
    url?: string;
    size?: number;
    type?: string;
  }) => {
    communication.sendMessage({
      from: 'file-upload-sync',
      to: 'all',
      type: 'file:uploaded',
      data: payload,
      priority: 'high',
    });
    communication.sendMessage({
      from: 'file-upload-sync',
      to: 'all',
      type: 'showcase:refresh-requested',
      data: { reason: 'file-upload', ...payload },
      priority: 'high',
    });
  };

  return { broadcastUpload };
};
