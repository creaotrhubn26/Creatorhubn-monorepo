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
import {
  COMMUNITY_DIALOG_ACTIONS_SX,
  COMMUNITY_DIALOG_CLOSE_BUTTON_SX,
  COMMUNITY_DIALOG_CONTENT_SX,
  COMMUNITY_DIALOG_FIELD_SX,
  COMMUNITY_DIALOG_PAPER_SX,
  COMMUNITY_DIALOG_PRIMARY_BUTTON_SX,
  COMMUNITY_DIALOG_SECONDARY_BUTTON_SX,
  COMMUNITY_DIALOG_SX,
  COMMUNITY_DIALOG_TEXT,
  COMMUNITY_DIALOG_TITLE_SX,
} from './communityDialogStyles';

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

  const handleUploadComplete = (results?: Array<Record<string, unknown>>) => {
    if (!results || results.length === 0) {
      return;
    }

    // Extract URLs and fileIds from upload results
    const fileData = results.map((result) => ({
      url:
        (typeof result.url === 'string' && result.url) ||
        (typeof result.fileUrl === 'string' && result.fileUrl) ||
        (typeof result.webViewLink === 'string' && result.webViewLink) ||
        '',
      ...(typeof result.fileId === 'string' ? { fileId: result.fileId } : {}),
      name:
        (typeof result.filename === 'string' && result.filename) ||
        (typeof result.name === 'string' && result.name) ||
        'file',
    }));

    const validFileData = fileData.filter((file) => file.url.length > 0);
    setAttachedFiles((prev) => [...prev, ...validFileData]);
    onFilesUploaded(validFileData.map((file) => ({ url: file.url, fileId: file.fileId })));
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
      <Tooltip title="Legg ved fil (Google Drive)">
        <IconButton
          size="small"
          onClick={() => setUploadDialogOpen(true)}
          disabled={disabled || attachedFiles.length >= 5}
        >
          <AttachFile fontSize="small" />
        </IconButton>
      </Tooltip>

      {/* Upload Dialog with UniversalFileUpload */}
      <Dialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        maxWidth="md"
        fullWidth
        sx={COMMUNITY_DIALOG_SX}
        PaperProps={{ sx: COMMUNITY_DIALOG_PAPER_SX }}
      >
        <DialogTitle sx={COMMUNITY_DIALOG_TITLE_SX}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, position: 'relative', zIndex: 1 }}>
            <Box
              component="img"
              src="https://fonts.gstatic.com/s/i/productlogos/drive_2020q4/v8/web-64dp/logo_drive_2020q4_color_2x_web_64dp.png"
              alt="Google Drive"
              sx={{ width: 24, height: 24 }}
            />
            <Box component="span" sx={{ color: COMMUNITY_DIALOG_TEXT, fontWeight: 800, fontSize: '1.05rem' }}>
              Legg ved filer
            </Box>
          </Box>
          <IconButton
            onClick={() => setUploadDialogOpen(false)}
            sx={{ ...COMMUNITY_DIALOG_CLOSE_BUTTON_SX, position: 'absolute', right: 16, top: 16 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={COMMUNITY_DIALOG_CONTENT_SX}>
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
      setShareEmail('');
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
      <Dialog
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        sx={COMMUNITY_DIALOG_SX}
        PaperProps={{ sx: COMMUNITY_DIALOG_PAPER_SX }}
      >
        <DialogTitle sx={COMMUNITY_DIALOG_TITLE_SX}>Del fil med bruker</DialogTitle>
        <DialogContent sx={COMMUNITY_DIALOG_CONTENT_SX}>
          {shareSuccess && <Alert severity="success" sx={{ mb: 2 }}>{shareSuccess}</Alert>}
          {shareError && <Alert severity="error" sx={{ mb: 2 }}>{shareError}</Alert>}

          <TextField
            fullWidth
            label="E-postadresse"
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
            sx={{ ...COMMUNITY_DIALOG_FIELD_SX, mb: 2, mt: 1 }}
            placeholder="bruker@example.com"
          />

          <TextField
            fullWidth
            select
            label="Tilgang"
            value={shareRole}
            onChange={(e) => setShareRole(e.target.value as any)}
            SelectProps={{ native: true }}
            sx={COMMUNITY_DIALOG_FIELD_SX}
          >
            <option value="reader">Leser (kan se)</option>
            <option value="commenter">Kommentator (kan kommentere)</option>
            <option value="writer">Skribent (kan redigere)</option>
          </TextField>
        </DialogContent>
        <DialogActions sx={COMMUNITY_DIALOG_ACTIONS_SX}>
          <Button onClick={() => setShareDialogOpen(false)} sx={COMMUNITY_DIALOG_SECONDARY_BUTTON_SX}>
            Avbryt
          </Button>
          <Button
            onClick={handleShareWithUser}
            variant="contained"
            disabled={!shareEmail}
            sx={COMMUNITY_DIALOG_PRIMARY_BUTTON_SX}
          >
            Del
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

function getFileType(url: string): 'document' | 'image' | 'video' | 'audio' | 'archive' | 'other' {
  const ext = url.split('.').pop()?.toLowerCase();
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext || '')) return 'image';
  if (['mp4','mov','avi','mkv','webm'].includes(ext || '')) return 'video';
  if (['mp3','wav','ogg','flac','m4a'].includes(ext || '')) return 'audio';
  if (['zip','rar','7z','tar','gz'].includes(ext || '')) return 'archive';
  if (['pdf','doc','docx','xls','xlsx','ppt', 'pptx'].includes(ext || '')) return 'document';
  return 'other';
}

function extractFileId(url: string): string | undefined {
  // Extract file ID from Google Drive URL
  // Formats:
  // - https://drive.google.com/file/d/{fileId}/view
  // - https://drive.google.com/open?id={fileId}
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : undefined;
}
