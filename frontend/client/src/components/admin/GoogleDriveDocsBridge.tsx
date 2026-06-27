/**
 * Google Drive Documentation Bridge
 * 
 * Connects Google Drive ↔ Documentation Browser ↔ Notes
 * Enables:
 * - Import docs from Google Drive
 * - Link Drive files to notes
 * - Export notes with doc references to Drive
 * - Sync documentation between Drive and local
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Stack,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  Divider,
  Tooltip,
  Badge,
  Snackbar,
} from '@mui/material';
import {
  CloudDownload as CloudDownloadIcon,
  CloudUpload as CloudUploadIcon,
  Sync as SyncIcon,
  Link as LinkIcon,
  Description as DescriptionIcon,
  Folder as FolderIcon,
  InsertDriveFile as InsertDriveFileIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { AdminCard, AdminButton } from './design-system';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  iconLink?: string;
  modifiedTime?: string;
  size?: number;
  isDoc?: boolean;
}

interface SyncStatus {
  driveToLocal: number;
  localToDrive: number;
  conflicts: number;
  lastSync: number;
}

interface Props {
  onDocImported?: (path: string, content: string) => void;
  onDriveFileLinked?: (fileId: string, fileName: string) => void;
  currentNoteId?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function GoogleDriveDocsBridge({ 
  onDocImported, 
  onDriveFileLinked,
  currentNoteId 
}: Props) {
  const queryClient = useQueryClient();
  const { 
    analytics, 
    performance, 
    auth, 
    features,
    communication,
    debugging 
  } = useEnhancedMasterIntegration();
  
  // State
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [openImportDialog, setOpenImportDialog] = useState(false);
  const [openSyncDialog, setOpenSyncDialog] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    driveToLocal: 0,
    localToDrive: 0,
    conflicts: 0,
    lastSync: 0
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  
  // 🔐 Feature Access
  const userProfile = auth.getUserProfile();
  const userId = userProfile?.id || 'anonymous';
  const driveAccess = features.checkFeatureAccess('google-drive-integration, ', userProfile?.role);
  const canUseDrive = driveAccess.hasAccess;
  
  // 📁 Fetch Google Drive folders
  const { data: driveFolders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['google-drive-folders', userId],
    queryFn: async () => {
      if (!canUseDrive) return [];
      
      const endTiming = performance.startTiming('fetch_drive_folders');
      try {
        const headers = await auth.getAuthHeader();
        const response = await apiRequest('/api/google/drive/folders', { headers });
        return response as DriveFile[];
      } finally {
        endTiming();
      }
    },
    enabled: canUseDrive,
    select: (d) => (Array.isArray(d) ? d : [])
  });
  
  // 📄 Fetch files in selected folder
  const { data: driveFiles = [], isLoading: filesLoading } = useQuery({
    queryKey: ['google-drive-files', selectedFolder, userId],
    queryFn: async () => {
      if (!canUseDrive || !selectedFolder) return [];
      
      const endTiming = performance.startTiming('fetch_drive_files');
      try {
        const headers = await auth.getAuthHeader();
        const response = await apiRequest(`/api/google/drive/files?folderId=${selectedFolder}`, { headers });
        return response as DriveFile[];
      } finally {
        endTiming();
      }
    },
    enabled: canUseDrive && !!selectedFolder,
    select: (d) => (Array.isArray(d) ? d : [])
  });
  
  // 📥 Import doc from Google Drive
  const importFromDrive = useMutation({
    mutationFn: async (file: DriveFile) => {
      const endTiming = performance.startTiming('import_from_drive');
      try {
        const headers = await auth.getAuthHeader();
        
        // Download file content from Drive
        const response = await apiRequest('/api/google/drive/download', {
          method: 'POST',
          body: JSON.stringify({ fileId: file.id, userId }),
          headers
        });
        
        // Save to local documentation
        await apiRequest('/api/docs/import', {
          method: 'POST',
          body: JSON.stringify({
            name: file.name,
            content: response.content,
            driveFileId: file.id,
            category: 'imported-from-drive',
            userId
          }),
          headers
        });
        
        return { ...file, content: response.content };
      } finally {
        endTiming();
      }
    },
    onSuccess: (data, file) => {
      queryClient.invalidateQueries({ queryKey: ['documentation-files'] });
      
      if (onDocImported) {
        onDocImported(`imported-from-drive/${file.name}`, data.content);
      }
      
      // 📢 Broadcast event
      communication.sendBroadcast('doc-imported-from-drive', {
        fileName: file.name,
        driveFileId: file.id,
        userId
      }, 'medium');
      
      analytics.trackEvent('doc_imported_from_drive', {
        fileName: file.name,
        fileId: file.id,
        userId
      });
      
      features.trackFeatureUsage('google-drive-integration','import-doc', {
        fileName: file.name
      });
    }
  });
  
  // 📤 Export documentation to Google Drive
  const exportToDrive = useMutation({
    mutationFn: async (params: { docPath: string; content: string; folderId?: string }) => {
      const endTiming = performance.startTiming('export_to_drive');
      try {
        const headers = await auth.getAuthHeader();
        
        return await apiRequest('/api/google/drive/upload-doc', {
          method: 'POST',
          body: JSON.stringify({
            name: params.docPath.split('/').pop(),
            content: params.content,
            folderId: params.folderId || selectedFolder,
            userId
          }),
          headers
        });
      } finally {
        endTiming();
      }
    },
    onSuccess: (data, params) => {
      communication.sendBroadcast('doc-exported-to-drive', {
        docPath: params.docPath,
        driveFileId: data.fileId,
        userId
      }, 'medium');
      
      analytics.trackEvent('doc_exported_to_drive', {
        docPath: params.docPath,
        userId
      });
    }
  });
  
  // 🔄 Sync Documentation with Google Drive
  const syncWithDrive = useMutation({
    mutationFn: async () => {
      setIsSyncing(true);
      const endTiming = performance.startTiming('sync_with_drive');
      
      try {
        const headers = await auth.getAuthHeader();
        
        const response = await apiRequest('/api/docs/sync-drive', {
          method: 'POST',
          body: JSON.stringify({ userId }),
          headers
        });
        
        setSyncStatus({
          driveToLocal: response.imported || 0,
          localToDrive: response.exported || 0,
          conflicts: response.conflicts || 0,
          lastSync: Date.now()
        });
        
        return response;
      } finally {
        endTiming();
        setIsSyncing(false);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['documentation-files'] });
      queryClient.invalidateQueries({ queryKey: ['google-drive-files'] });
      
      communication.sendBroadcast('docs-synced-with-drive', {
        imported: data.imported,
        exported: data.exported,
        userId
      }, 'high');
      
      analytics.trackEvent('docs_synced_with_drive', {
        imported: data.imported,
        exported: data.exported,
        userId
      });
      
      features.trackFeatureUsage('google-drive-integration', 'sync-docs', {
        imported: data.imported,
        exported: data.exported
      });
    }
  });
  
  // 🔗 Link Drive file to current note
  const linkToNote = useCallback((file: DriveFile) => {
    if (!currentNoteId) {
      setSnackbar({ open: true, message: 'Please select a note first' });
      return;
    }
    
    if (onDriveFileLinked) {
      onDriveFileLinked(file.id, file.name);
    }
    
    // 📢 Broadcast event
    communication.sendBroadcast('drive-file-linked-to-note', {
      noteId: currentNoteId,
      driveFileId: file.id,
      fileName: file.name,
      userId
    }, 'medium');
    
    analytics.trackEvent('drive_file_linked_to_note', {
      noteId: currentNoteId,
      driveFileId: file.id,
      userId
    });
  }, [currentNoteId, onDriveFileLinked, communication, analytics, userId]);
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  if (!canUseDrive) {
    return (
      <Alert severity="warning">
        <Typography variant="body2">
          {driveAccess.reason}
        </Typography>
      </Alert>
    );
  }
  
  return (
    <AdminCard
      title="Google Drive Bridge"
      action={
        <Stack direction="row" spacing={1}>
          <Tooltip title="Import docs from Drive">
            <IconButton size="small" onClick={() => setOpenImportDialog(true)}>
              <CloudDownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Sync with Drive">
            <IconButton
              size="small"
              onClick={() => syncWithDrive.mutate()}
              disabled={isSyncing}
            >
              {isSyncing ? <CircularProgress size={20} /> : <SyncIcon />}
            </IconButton>
          </Tooltip>
        </Stack>
      }
    >
      <Stack spacing={2}>

        {/* Sync Status */}
        {syncStatus.lastSync > 0 && (
          <Alert severity="success" icon={<CheckCircleIcon />}>
            <Typography variant="caption">
              Last sync: {new Date(syncStatus.lastSync).toLocaleString()}
              <br />
              ↓ {syncStatus.driveToLocal} imported | ↑ {syncStatus.localToDrive} exported
              {syncStatus.conflicts > 0 && ` | ⚠️ ${syncStatus.conflicts} conflicts`}
            </Typography>
          </Alert>
        )}
        
        {/* Quick Actions */}
        <Stack spacing={1}>
          <AdminButton
            fullWidth
            tone="secondary"
            startIcon={<CloudDownloadIcon />}
            onClick={() => setOpenImportDialog(true)}
          >
            Import from Drive
          </AdminButton>
          <AdminButton
            fullWidth
            tone="secondary"
            startIcon={<SyncIcon />}
            onClick={() => syncWithDrive.mutate()}
            loading={isSyncing}
            disabled={isSyncing}
          >
            {isSyncing ? 'Syncing...' : 'Sync All Docs'}
          </AdminButton>
        </Stack>
      </Stack>
      
      {/* Import Dialog */}
      <Dialog 
        open={openImportDialog} 
        onClose={() => setOpenImportDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <CloudDownloadIcon color="primary" />
            <Typography variant="h6">Import from Google Drive</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            {/* Folder Selection */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Select Folder:
              </Typography>
              {foldersLoading ? (
                <CircularProgress size={24} />
              ) : (
                <List dense>
                  {driveFolders.map((folder) => (
                    <ListItem key={folder.id} disablePadding>
                      <ListItemButton
                        selected={selectedFolder === folder.id}
                        onClick={() => setSelectedFolder(folder.id)}
                      >
                        <ListItemIcon>
                          <FolderIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText primary={folder.name} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
            
            <Divider />
            
            {/* File List */}
            {selectedFolder && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Files in Folder:
                </Typography>
                {filesLoading ? (
                  <CircularProgress size={24} />
                ) : driveFiles.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No files in this folder
                  </Typography>
                ) : (
                  <List dense>
                    {driveFiles
                      .filter(f => 
                        f.mimeType.includes('document') || 
                        f.mimeType.includes('text') ||
                        f.name.endsWith('.md')
                      )
                      .map((file) => (
                        <ListItem 
                          key={file.id}
                          secondaryAction={
                            <Stack direction="row" spacing={0.5}>
                              <Tooltip title="Import to Documentation Browser">
                                <IconButton
                                  edge="end"
                                  size="small"
                                  onClick={() => {
                                    importFromDrive.mutate(file);
                                    setOpenImportDialog(false);
                                  }}
                                  disabled={importFromDrive.isPending}
                                >
                                  <CloudDownloadIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {currentNoteId && (
                                <Tooltip title="Link to current note">
                                  <IconButton
                                    edge="end"
                                    size="small"
                                    onClick={() => {
                                      linkToNote(file);
                                      setOpenImportDialog(false);
                                    }}
                                  >
                                    <LinkIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Stack>
                          }
                        >
                          <ListItemIcon>
                            <InsertDriveFileIcon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary={file.name}
                            secondary={file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : ''}
                            primaryTypographyProps={{ variant: 'body2' }}
                            secondaryTypographyProps={{ variant: 'caption' }}
                          />
                        </ListItem>
                      ))}
                  </List>
                )}
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setOpenImportDialog(false)}>Close</AdminButton>
        </DialogActions>
      </Dialog>

      {/* Snackbar Notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ open: false, message: '' })}
          severity="warning"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </AdminCard>
  );
}


