/**
 * Community File Attachment Component
 * Wrapper around UniversalFileUpload for community messages
 * Integrates with Google Drive for file storage
 */

import React, { useState } from 'react';
import {
  Box,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  TextField,
  Button,
  DialogActions,
  Alert,
} from '@mui/material';
import {
  AttachFile,
  Close,
  MoreVert,
  Share,
  Public,
  Link as LinkIcon,
  PersonAdd,
} from '@mui/icons-material';
import { UniversalFileUpload } from '@/components/universal/UniversalFileUpload';
import { UniversalDownload } from '@/components/universal/UniversalDownload';
import { apiRequest } from '@/lib/queryClient';

interface CommunityFileAttachmentProps {
  userId: string;
  channelId: string;
  onFilesUploaded: (files: Array<{ url: string; fileId?: string }>) => void;
  disabled?: boolean;
}

export const CommunityFileAttachment: React.FC<CommunityFileAttachmentProps> = ({
  userId,
  channelId,
  onFilesUploaded,
  disabled = false,
}) => {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<Array<{ url: string; fileId?: string; name: string }>>([]);

  const handleUploadComplete = (results: any[]) => {
    // Extract URLs and fileIds from upload results
    const fileData = results.map((result) => ({
      url: result.url || result.fileUrl || result.webViewLink,
      fileId: result.fileId,
      name: result.filename || result.name || 'file',
    }));

    setAttachedFiles((prev) => [...prev, ...fileData]);
    onFilesUploaded(fileData.map(f => ({ url: f.url, fileId: f.fileId })));
    setUploadDialogOpen(false);
  };

  const handleRemoveFile = (index: number) => {
    const remaining = attachedFiles.filter((_, i) => i !== index);
    setAttachedFiles(remaining);
    // Update parent with remaining files
    onFilesUploaded(remaining.map(f => ({ url: f.url, fileId: f.fileId })));
  };

  return (
    <>
      {/* Attached Files Preview */}
      {attachedFiles.length > 0 && (
        <Box sx={{ mb: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {attachedFiles.map((file, index) => (
            <Chip
              key={index}
              label={file.name}
              onDelete={() => handleRemoveFile(index)}
              size="small"
              icon={<AttachFile />}
            />
          ))}
        </Box>
      )}

      {/* Attach File Button */}
      <Tooltip title="Legg til vedlegg">
        <IconButton
          size="small"
          onClick={() => setUploadDialogOpen(true)}
          disabled={disabled || attachedFiles.length >= 5}
          sx={{
            color: 'rgba(255, 255, 255, 0.7)',
            minWidth: { xs: '44px', sm: '48px', md: '52px', lg: '56px' },
            minHeight: { xs: '44px', sm: '48px', md: '52px', lg: '56px' },
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            borderRadius: '10px',
            '&:hover': {
              color: '#f59e0b',
              background: 'rgba(245, 158, 11, 0.2)',
              borderColor: 'rgba(245, 158, 11, 0.4)',
              transform: 'scale(1.05)',
            },
            '&:focus': {
              outline: '3px solid #f59e0b',
              outlineOffset: '2px',
            },
            transition: 'all 0.2s ease',
          }}
        >
          <AttachFile sx={{ fontSize: { xs: 20, sm: 22, md: 24, lg: 26, xl: 28 } }} />
        </IconButton>
      </Tooltip>

      {/* Upload Dialog with UniversalFileUpload */}
      <Dialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              component="img"
              src="https://fonts.gstatic.com/s/i/productlogos/drive_2020q4/v8/web-64dp/logo_drive_2020q4_color_2x_web_64dp.png"
              alt="Google Drive"
              sx={{ width: 24, height: 24 }}
            />
            <span>Legg ved filer</span>
          </Box>
          <IconButton
            onClick={() => setUploadDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <UniversalFileUpload
            userId={userId}
            projectId={channelId}
            maxFiles={5 - attachedFiles.length}
            maxFileSizeMB={50}
            allowedTypes="all"
            showFormatInfo={false}
            uploadEndpoint="/api/community/upload"
            additionalMetadata={{
              type: 'community_attachment',
              channelId,
              userId}}
            enableGoogleDriveSync={true}
            enableBackgroundUpload={true}
            enableAdvancedQueue={false}
            showStorageInfo={false}
            showQueueStatus={false}
            enableMultipleFiles={true}
            enableDragDrop={true}
            onUploadComplete={handleUploadComplete}
            onUploadError={(error) => {
              console.error('Upload error: ', error);
              alert('Kunne ikke laste opp fil: ' + error);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

interface CommunityFileDisplayProps {
  attachments: Array<{ url: string; fileId?: string }> | string[];
  userId: string;
  isOwner?: boolean;
}

export const CommunityFileDisplay: React.FC<CommunityFileDisplayProps> = ({
  attachments,
  userId,
  isOwner = false,
}) => {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedFile, setSelectedFile] = useState<{ url: string; fileId?: string } | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState<'reader' | 'writer' | 'commenter'>('reader');
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  if (!attachments || attachments.length === 0) return null;

  // Normalize attachments to array of objects
  const normalizedAttachments = attachments.map((item) =>
    typeof item === 'string' ? { url: item, fileId: extractFileId(item) } : item
  );

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, file: { url: string; fileId?: string }) => {
    setMenuAnchor(event.currentTarget);
    setSelectedFile(file);
  };

  const handleCloseMenu = () => {
    setMenuAnchor(null);
    setSelectedFile(null);
  };

  const handleCopyLink = () => {
    if (selectedFile) {
      navigator.clipboard.writeText(selectedFile.url);
      alert('Link kopiert til utklippstavlen!');
      handleCloseMenu();
    }
  };

  const handleMakePublic = async () => {
    if (!selectedFile?.fileId) return;

    try {
      await apiRequest(`/api/community/files/${selectedFile.fileId}/make-public`, {
        method: 'POST',
      });
      alert('Filen er nå offentlig tilgjengelig!');
      handleCloseMenu();
    } catch (error) {
      console.error('Error making file public: ', error);
      alert('Kunne ikke gjøre filen offentlig');
    }
  };

  const handleOpenShareDialog = () => {
    setShareDialogOpen(true);
    setShareSuccess(null);
    setShareError(null);
    handleCloseMenu();
  };

  const handleShareWithUser = async () => {
    if (!selectedFile?.fileId || !shareEmail) return;

    try {
      await apiRequest(`/api/community/files/${selectedFile.fileId}/share`, {
        method: 'POST',
        body: JSON.stringify({
          email: shareEmail,
          role: shareRole,
        }),
      });
      setShareSuccess(`Filen er delt med ${shareEmail}!`);
      setShareEmail(', ');
    } catch (error) {
      console.error('Error sharing file:', error);
      setShareError('Kunne ikke dele filen');
    }
  };

  const downloadItems = normalizedAttachments.map((item) => ({
    url: item.url,
    filename: item.url.split('/').pop() || 'file',
    type: getFileType(item.url),
  }));

  return (
    <>
      <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {normalizedAttachments.map((file, index) => {
          const isImage = file.url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
          return (
            <Box key={index} sx={{ position: 'relative', display: 'inline-block' }}>
              {isImage ? (
                <Box
                  component="img"
                  src={file.url}
                  alt="attachment"
                  sx={{
                    maxWidth: 300,
                    maxHeight: 200,
                    borderRadius: 1,
                    cursor: 'pointer',
                    '&:hover': { opacity: 0.9 }
                  }}
                  onClick={() => window.open(file.url, '_blank')}
                />
              ) : (
                <UniversalDownload
                  items={[downloadItems[index]]}
                  userId={userId}
                  variant="icon"
                  size="small"
                  enableGoogleDriveSync={true}
                  enableBackground={true}
                />
              )}
              {isOwner && file.fileId && (
                <IconButton
                  size="small"
                  onClick={(e) => handleOpenMenu(e, file)}
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    bgcolor: 'rgba(0,0,0,0.5)',
                    color: 'white','&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }}}
                >
                  <MoreVert fontSize="small" />
                </IconButton>
              )}
            </Box>
          );
        })}
      </Box>

      {/* File Options Menu */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleCloseMenu}>
        <MenuItem onClick={handleCopyLink}>
          <ListItemIcon>
            <LinkIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Kopier lenke</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMakePublic}>
          <ListItemIcon>
            <Public fontSize="small" />
          </ListItemIcon>
          <ListItemText>Gjør offentlig</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleOpenShareDialog}>
          <ListItemIcon>
            <PersonAdd fontSize="small" />
          </ListItemIcon>
          <ListItemText>Del med bruker</ListItemText>
        </MenuItem>
      </Menu>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Del fil med bruker</DialogTitle>
        <DialogContent>
          {shareSuccess && <Alert severity="success" sx={{ mb: 2 }}>{shareSuccess}</Alert>}
          {shareError && <Alert severity="error" sx={{ mb: 2 }}>{shareError}</Alert>}

          <TextField
            fullWidth
            label="E-postadresse"
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
            placeholder="bruker@example.com"
          />

          <TextField
            fullWidth
            select
            label="Tilgang"
            value={shareRole}
            onChange={(e) => setShareRole(e.target.value as any)}
            SelectProps={{ native: true }}
          >
            <option value="reader">Leser (kan se)</option>
            <option value="commenter">Kommentator (kan kommentere)</option>
            <option value="writer">Skribent (kan redigere)</option>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>Avbryt</Button>
          <Button onClick={handleShareWithUser} variant="contained" disabled={!shareEmail}>
            Del
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

function getFileType(url: string): 'document' | 'image' | 'video' | 'audio' | 'archive' | 'other' {
  const ext = url.split('.').pop()?.toLowerCase();
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext || ',')) return 'image';
  if (['mp4','mov','avi','mkv','webm'].includes(ext || ',')) return 'video';
  if (['mp3','wav','ogg','flac','m4a'].includes(ext || ',')) return 'audio';
  if (['zip','rar','7z','tar','gz'].includes(ext || ', ')) return 'archive';
  if (['pdf','doc','docx','xls','xlsx','ppt', 'pptx'].includes(ext || ',')) return 'document';
  return'other';
}

function extractFileId(url: string): string | undefined {
  // Extract file ID from Google Drive URL
  // Formats:
  // - https://drive.google.com/file/d/{fileId}/view
  // - https://drive.google.com/open?id={fileId}
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : undefined;
}

