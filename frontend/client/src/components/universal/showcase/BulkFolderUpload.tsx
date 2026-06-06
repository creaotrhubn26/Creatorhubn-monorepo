/**
 * Bulk Folder Upload Component
 * Allows bulk creation of collections by drag-dropping folders from desktop
 * Each folder creates its own collection, subfolders are combined into single collection
 */

import React, { useState, useCallback, useRef } from 'react';
import { useDynamicProfessions } from '../../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useTheming } from '@/utils/theming-helper';
import {
  Box,
  Typography,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  TextField,
  LinearProgress,
  Alert,
  Chip,
  Stack,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Divider,
  alpha,
  Collapse,
  Tooltip,
  Snackbar,
} from '@mui/material';
import {
  CloudUpload,
  Folder,
  FolderOpen,
  Delete,
  Edit,
  Check,
  Close,
  PhotoLibrary,
  VideoLibrary,
  MusicNote,
  InsertDriveFile,
  Lock,
  LockOpen,
  ExpandMore,
  ExpandLess,
  CreateNewFolder,
  Info,
} from '@mui/icons-material';

/// Validate a single file against the active profession's whitelist
/// (`config.settings.supportedFileTypes`) and size cap
/// (`config.settings.maxFileSize` in MB). Returns the reason a file
/// would be rejected, or null when accepted. Centralised here so the
/// drag-drop and file-browse code paths can't drift.
function rejectionReason(
  file: File,
  supportedExtensions: string[] | null | undefined,
  maxSizeMB: number | null | undefined,
): string | null {
  const sizeBytesCap = (maxSizeMB && maxSizeMB > 0) ? maxSizeMB * 1024 * 1024 : null;
  if (sizeBytesCap !== null && file.size > sizeBytesCap) {
    return `${file.name}: ${(file.size / 1024 / 1024).toFixed(1)} MB exceeds the ${maxSizeMB} MB cap for this profession`;
  }
  // No whitelist configured = accept everything that's plausibly media.
  // We still require image/video/audio MIME or a known RAW extension as
  // the absolute floor — protects against accidentally uploading PDFs
  // or .DS_Store junk.
  const hasGenericMedia =
    file.type.startsWith('image/') ||
    file.type.startsWith('video/') ||
    file.type.startsWith('audio/') ||
    /\.(raw|arw|cr2|cr3|nef|orf|rw2|dng|raf|pef|srw|x3f)$/i.test(file.name);
  if (!supportedExtensions || supportedExtensions.length === 0) {
    return hasGenericMedia ? null : `${file.name}: not a supported media type`;
  }
  // Whitelist configured: extension must be in the list. Compare lowercase
  // and strip leading dots so the config can use either `jpg` or `.jpg`.
  const lastDot = file.name.lastIndexOf('.');
  const ext = lastDot >= 0 ? file.name.slice(lastDot + 1).toLowerCase() : '';
  const allowed = new Set(supportedExtensions.map((s) => s.replace(/^\./, '').toLowerCase()));
  // Special-case: 'raw' in the list means "accept any of the canonical
  // raw extensions" so a photographer config doesn't have to enumerate
  // every camera vendor's variant.
  if (allowed.has('raw') && /\.(raw|arw|cr2|cr3|nef|orf|rw2|dng|raf|pef|srw|x3f)$/i.test(file.name)) {
    return null;
  }
  if (allowed.has(ext)) return null;
  return `${file.name}: .${ext || '?'} not in this profession's allowed types (${Array.from(allowed).join(', ')})`;
}

interface FolderUploadItem {
  id: string;
  name: string;
  path: string;
  files: File[];
  fileCount: number;
  totalSize: number;
  subfolders: string[];
  preview?: string; // First image thumbnail
}

interface CollectionSettings {
  enablePassword: boolean;
  password: string;
  enableDownloads: boolean;
  enableComments: boolean;
  enableFavorites: boolean;
  visibility: 'private' | 'team' | 'public';
  watermarkEnabled: boolean;
}

interface BulkFolderUploadProps {
  open: boolean;
  onClose: () => void;
  onCreateCollections: (folders: FolderUploadItem[], settings: CollectionSettings) => Promise<void>;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
  accentColor: string;
  parentFolderId?: string;
}

const BulkFolderUpload: React.FC<BulkFolderUploadProps> = ({
  open,
  onClose,
  onCreateCollections,
  profession,
  accentColor,
  parentFolderId
}) => {
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || profession || 'photographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || accentColor || '#FF6B35';
  const theming = useTheming(currentProfession);
  
  // State
  const [folders, setFolders] = useState<FolderUploadItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'preparing' | 'uploading' | 'finalizing'>('idle');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [settings, setSettings] = useState<CollectionSettings>({
    enablePassword: false,
    password: '',
    enableDownloads: true,
    enableComments: true,
    enableFavorites: true,
    visibility: 'private',
    watermarkEnabled: false
  });

  const dropZoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // Get file type icon
  const getFileTypeIcon = (files: File[]) => {
    const hasImages = files.some(f => f.type.startsWith('image/'));
    const hasVideos = files.some(f => f.type.startsWith('video/'));
    const hasAudio = files.some(f => f.type.startsWith('audio/'));
    
    if (hasVideos) return <VideoLibrary sx={{ color: accentColor }} />;
    if (hasImages) return <PhotoLibrary sx={{ color: accentColor }} />;
    if (hasAudio) return <MusicNote sx={{ color: accentColor }} />;
    return <InsertDriveFile sx={{ color: accentColor }} />;
  };

  // Process dropped items (files/folders)
  const processDroppedItems = useCallback(async (items: DataTransferItemList) => {
    const newFolders: FolderUploadItem[] = [];
    const rejectedFilesAcrossFolders: string[] = [];

    const readDirectory = async (entry: FileSystemDirectoryEntry, parentPath: string = ', '): Promise<File[]> => {
      const files: File[] = [];
      const reader = entry.createReader();
      
      const readEntries = (): Promise<FileSystemEntry[]> => {
        return new Promise((resolve, reject) => {
          reader.readEntries(resolve, reject);
        });
      };

      let entries: FileSystemEntry[] = [];
      let batch: FileSystemEntry[];
      
      // Read all entries (readEntries returns max 100 at a time)
      do {
        batch = await readEntries();
        entries = entries.concat(batch);
      } while (batch.length > 0);

      for (const childEntry of entries) {
        if (childEntry.isFile) {
          const file = await new Promise<File>((resolve, reject) => {
            (childEntry as FileSystemFileEntry).file(resolve, reject);
          });
          files.push(file);
        } else if (childEntry.isDirectory) {
          // Recursively read subdirectories (files combined into parent)
          const subFiles = await readDirectory(childEntry as FileSystemDirectoryEntry, `${parentPath}/${entry.name}`);
          files.push(...subFiles);
        }
      }
      
      return files;
    };

    // Process each dropped item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const entry = item.webkitGetAsEntry?.();

      if (entry?.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry;
        const files = await readDirectory(dirEntry);

        // Filter against the active profession's whitelist + size cap.
        // Rejected files surface in `rejections` so the photographer
        // sees exactly which files (and why) didn't make it in.
        const supported = (enhancedProfessionConfig as any)?.settings?.supportedFileTypes as string[] | undefined;
        const maxMB = (enhancedProfessionConfig as any)?.settings?.maxFileSize as number | undefined;
        const validFiles: File[] = [];
        for (const f of files) {
          const reason = rejectionReason(f, supported, maxMB);
          if (reason) {
            rejectedFilesAcrossFolders.push(reason);
          } else {
            validFiles.push(f);
          }
        }

        if (validFiles.length > 0) {
          // Create preview from first image
          let preview: string | undefined;
          const firstImage = validFiles.find(f => f.type.startsWith('image/'));
          if (firstImage) {
            preview = URL.createObjectURL(firstImage);
          }

          newFolders.push({
            id: `folder-${Date.now()}-${i}`,
            name: dirEntry.name,
            path: dirEntry.fullPath,
            files: validFiles,
            fileCount: validFiles.length,
            totalSize: validFiles.reduce((sum, f) => sum + f.size, 0),
            subfolders: [], // Subfolders are combined
            preview
          });
        }
      }
    }

    if (newFolders.length === 0) {
      const supported = (enhancedProfessionConfig as any)?.settings?.supportedFileTypes as string[] | undefined;
      const list = (supported && supported.length > 0)
        ? supported.join(', ')
        : 'images, videos, audio, and RAW files';
      const sample = rejectedFilesAcrossFolders.slice(0, 3).join('; ');
      setError(
        `No valid media files for ${currentProfession}. Allowed: ${list}.` +
        (sample ? ` Rejected examples — ${sample}` : '')
      );
    } else {
      setFolders(prev => [...prev, ...newFolders]);
      // If some files were rejected even though others made it in, surface
      // a non-blocking note so the user knows what was filtered out.
      if (rejectedFilesAcrossFolders.length > 0) {
        const sample = rejectedFilesAcrossFolders.slice(0, 3).join('; ');
        const moreCount = Math.max(0, rejectedFilesAcrossFolders.length - 3);
        setError(
          `Skipped ${rejectedFilesAcrossFolders.length} file(s) that don't match this profession's allowed types: ${sample}` +
          (moreCount > 0 ? ` (+${moreCount} more)` : '')
        );
      } else {
        setError(null);
      }
    }
  }, [enhancedProfessionConfig, currentProfession]);

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.items) {
      await processDroppedItems(e.dataTransfer.items);
    }
  }, [processDroppedItems]);

  // Handle folder browse (limited to single folder due to browser limitations)
  const handleBrowse = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Group files by their relative path (folder structure)
    const folderMap = new Map<string, File[]>();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const path = (file as any).webkitRelativePath || file.name;
      const folderName = path.split('/')[0] || 'Uploaded Files';

      if (!folderMap.has(folderName)) {
        folderMap.set(folderName, []);
      }
      folderMap.get(folderName)!.push(file);
    }

    const newFolders: FolderUploadItem[] = [];
    let index = 0;

    for (const [folderName, folderFiles] of folderMap) {
      const validFiles = folderFiles.filter(f =>
        f.type.startsWith('image/') ||
        f.type.startsWith('video/') ||
        f.type.startsWith('audio/') ||
        /\.(raw|arw|cr2|cr3|nef|orf|rw2|dng|raf|pef|srw|x3f)$/i.test(f.name)
      );

      if (validFiles.length > 0) {
        let preview: string | undefined;
        const firstImage = validFiles.find(f => f.type.startsWith('image/'));
        if (firstImage) {
          preview = URL.createObjectURL(firstImage);
        }

        newFolders.push({
          id: `folder-${Date.now()}-${index++}`,
          name: folderName,
          path: `/${folderName}`,
          files: validFiles,
          fileCount: validFiles.length,
          totalSize: validFiles.reduce((sum, f) => sum + f.size, 0),
          subfolders: [],
          preview
        });
      }
    }

    if (newFolders.length > 0) {
      setFolders(prev => [...prev, ...newFolders]);
      setError(null);
    }

    // Reset input
    e.target.value = '';
  }, []);

  // Remove folder from list
  const handleRemoveFolder = useCallback((folderId: string) => {
    setFolders(prev => {
      const folder = prev.find(f => f.id === folderId);
      if (folder?.preview) {
        URL.revokeObjectURL(folder.preview);
      }
      return prev.filter(f => f.id !== folderId);
    });
  }, []);

  // Edit folder name
  const handleStartEdit = useCallback((folder: FolderUploadItem) => {
    setEditingFolder(folder.id);
    setEditingName(folder.name);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingFolder && editingName.trim()) {
      setFolders(prev => prev.map(f =>
        f.id === editingFolder ? { ...f, name: editingName.trim() } : f
      ));
    }
    setEditingFolder(null);
    setEditingName('');
  }, [editingFolder, editingName]);

  // Create collections and upload
  const handleCreateAndUpload = useCallback(async () => {
    if (folders.length === 0) return;

    const collectionCount = folders.length;
    const fileCount = folders.reduce((sum, f) => sum + f.fileCount, 0);

    setIsUploading(true);
    setUploadProgress(0);
    setUploadPhase('preparing');
    setError(null);

    try {
      setUploadPhase('uploading');
      await onCreateCollections(folders, settings);
      setUploadPhase('finalizing');

      folders.forEach(f => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });

      setFolders([]);
      setSuccessMessage(
        `${collectionCount} samling${collectionCount === 1 ? '' : 'er'} opprettet med ${fileCount} fil${fileCount === 1 ? '' : 'er'}.`
      );
      setUploadPhase('idle');
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        `Kunne ikke opprette samlinger: ${message}. ${fileCount} fil${fileCount === 1 ? '' : 'er'} ble ikke lastet opp. Prøv på nytt eller fjern problemfilene.`
      );
      setUploadPhase('idle');
    } finally {
      setIsUploading(false);
    }
  }, [folders, settings, onCreateCollections, onClose]);

  // Calculate totals
  const totalFiles = folders.reduce((sum, f) => sum + f.fileCount, 0);
  const totalSize = folders.reduce((sum, f) => sum + f.totalSize, 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3, minHeight: '60vh' }
      }}
    >
      <DialogTitle sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        borderBottom: '1px solid',
        borderColor: 'divider'
      }}>
        {professionIcon && (
          <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
            {professionIcon}
          </Box>
        )}
        <CreateNewFolder sx={{ color: accentColor }} />
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {enhancedProfessionConfig?.displayName || professionConfig?.displayName
            ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Bulk Create Collections`
            : 'Bulk Create Collections'}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {/* Hidden file input for browse */}
        <input
          ref={fileInputRef}
          type="file"
          webkitdirectory=""
          directory=""
          multiple
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />

        {/* Drop Zone */}
        <Box
          ref={dropZoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          sx={{
            m: 2,
            p: 4,
            border: '2px dashed',
            borderColor: isDragOver ? accentColor : 'divider',
            borderRadius: 2,
            bgcolor: isDragOver ? alpha(accentColor, 0.05) : 'transparent',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease', '&:hover': {
              borderColor: accentColor,
              bgcolor: alpha(accentColor, 0.02)
            }
          }}
        >
          <CloudUpload sx={{ fontSize: 48, color: isDragOver ? accentColor : 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Drag folders here to create collections
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Each folder will create its own collection. Subfolders are combined.
          </Typography>
          <Button
            variant="outlined"
            onClick={handleBrowse}
            sx={{ mt: 2, borderColor: accentColor, color: accentColor }}
          >
            Browse Files
          </Button>
          <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
            Note: Browse only allows one folder at a time due to browser limitations
          </Typography>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mx: 2, mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Folder List */}
        {folders.length > 0 && (
          <Box sx={{ mx: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                Collections to Create ({folders.length})
              </Typography>
              <Chip
                label={`${totalFiles} files • ${formatSize(totalSize)}`}
                size="small"
                sx={{ bgcolor: alpha(accentColor, 0.1), color: accentColor }}
              />
            </Box>

            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <List dense disablePadding>
                {folders.map((folder, index) => (
                  <React.Fragment key={folder.id}>
                    {index > 0 && <Divider />}
                    <ListItem
                      sx={{
                        py: 1.5, '&:hover': { bgcolor: alpha(accentColor, 0.02) }
                      }}
                    >
                      {/* Preview thumbnail */}
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 1,
                          overflow: 'hidden',
                          bgcolor: alpha(accentColor, 0.1),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mr: 2,
                          flexShrink: 0
                        }}
                      >
                        {folder.preview ? (
                          <img
                            src={folder.preview}
                            alt={folder.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <Folder sx={{ color: accentColor }} />
                        )}
                      </Box>

                      <ListItemText
                        primary={
                          editingFolder === folder.id ? (
                            <TextField
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit();
                                if (e.key === 'Escape') setEditingFolder(null);
                              }}
                              size="small"
                              autoFocus
                              sx={{ '& input': { py: 0.5 } }}
                            />
                          ) : (
                            <Typography variant="body1" fontWeight={500}>
                              {folder.name}
                            </Typography>
                          )
                        }
                        secondary={
                          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                            <Chip
                              icon={getFileTypeIcon(folder.files)}
                              label={`${folder.fileCount} files`}
                              size="small"
                              variant="outlined"
                            />
                            <Chip
                              label={formatSize(folder.totalSize)}
                              size="small"
                              variant="outlined"
                            />
                          </Stack>
                        }
                      />

                      <ListItemSecondaryAction>
                        {editingFolder === folder.id ? (
                          <>
                            <IconButton size="small" onClick={handleSaveEdit} color="primary">
                              <Check />
                            </IconButton>
                            <IconButton size="small" onClick={() => setEditingFolder(null)}>
                              <Close />
                            </IconButton>
                          </>
                        ) : (
                          <>
                            <Tooltip title="Edit name">
                              <IconButton size="small" onClick={() => handleStartEdit(folder)}>
                                <Edit />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Remove">
                              <IconButton size="small" onClick={() => handleRemoveFolder(folder.id)} color="error">
                                <Delete />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </ListItemSecondaryAction>
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            </Paper>
          </Box>
        )}
      </DialogContent>

      {/* Settings Panel and Actions - continued in next edit */}
      {folders.length > 0 && (
        <Box sx={{ px: 2, pb: 2 }}>
          {/* Settings Toggle */}
          <Button
            onClick={() => setShowSettings(!showSettings)}
            startIcon={showSettings ? <ExpandLess /> : <ExpandMore />}
            sx={{ mb: 1, color: 'text.secondary' }}
          >
            Collection Settings
          </Button>

          <Collapse in={showSettings}>
            <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={settings.enablePassword}
                      onChange={(e) => setSettings(s => ({ ...s, enablePassword: e.target.checked }))}
                      sx={{ color: accentColor, '&.Mui-checked': { color: accentColor } }}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {settings.enablePassword ? <Lock fontSize="small" /> : <LockOpen fontSize="small" />}
                      Add folder password
                    </Box>
                  }
                />
                {settings.enablePassword && (
                  <TextField
                    size="small"
                    type="password"
                    placeholder="Enter password"
                    value={settings.password}
                    onChange={(e) => setSettings(s => ({ ...s, password: e.target.value }))}
                    sx={{ ml: 4, mt: 1, maxWidth: 250 }}
                  />
                )}
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={settings.enableDownloads}
                      onChange={(e) => setSettings(s => ({ ...s, enableDownloads: e.target.checked }))}
                      sx={{ color: accentColor, '&.Mui-checked': { color: accentColor } }}
                    />
                  }
                  label="Allow downloads"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={settings.enableComments}
                      onChange={(e) => setSettings(s => ({ ...s, enableComments: e.target.checked }))}
                      sx={{ color: accentColor, '&.Mui-checked': { color: accentColor } }}
                    />
                  }
                  label="Allow comments"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={settings.enableFavorites}
                      onChange={(e) => setSettings(s => ({ ...s, enableFavorites: e.target.checked }))}
                      sx={{ color: accentColor, '&.Mui-checked': { color: accentColor } }}
                    />
                  }
                  label="Allow favorites"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={settings.watermarkEnabled}
                      onChange={(e) => setSettings(s => ({ ...s, watermarkEnabled: e.target.checked }))}
                      sx={{ color: accentColor, '&.Mui-checked': { color: accentColor } }}
                    />
                  }
                  label="Apply watermark"
                />
              </FormGroup>
            </Paper>
          </Collapse>

          {/* Info */}
          <Alert severity="info" icon={<Info />} sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Tip:</strong> Drag-and-dropping folders is recommended. The 'Browse' option only allows one folder at a time due to browser limitations.
            </Typography>
          </Alert>

          {/* Upload Progress */}
          {isUploading && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress
                variant="indeterminate"
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: alpha(accentColor, 0.1),
                  '& .MuiLinearProgress-bar': { bgcolor: accentColor },
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {uploadPhase === 'preparing' && `Forbereder ${folders.length} samling${folders.length === 1 ? '' : 'er'}…`}
                {uploadPhase === 'uploading' && `Laster opp ${totalFiles} fil${totalFiles === 1 ? '' : 'er'} til ${folders.length} samling${folders.length === 1 ? '' : 'er'}… Ikke lukk vinduet.`}
                {uploadPhase === 'finalizing' && 'Ferdigstiller…'}
                {uploadPhase === 'idle' && 'Behandler…'}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={onClose} disabled={isUploading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleCreateAndUpload}
          disabled={folders.length === 0 || isUploading}
          startIcon={<CloudUpload />}
            sx={{
              bgcolor: accentColor,
              '&:hover': { bgcolor: alpha(accentColor, 0.9) }
            }}
        >
          {isUploading
            ? (uploadPhase === 'finalizing' ? 'Ferdigstiller…' : 'Laster opp…')
            : `Opprett & last opp (${folders.length} samling${folders.length === 1 ? '' : 'er'}, ${totalFiles} fil${totalFiles === 1 ? '' : 'er'})`}
        </Button>
      </DialogActions>

      <Snackbar
        open={!!successMessage}
        autoHideDuration={4000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          onClose={() => setSuccessMessage(null)}
          sx={{ width: '100%' }}
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </Dialog>
  );
};

export default BulkFolderUpload;

// Type declarations for webkit directory attributes
declare module'react' {
  interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}
