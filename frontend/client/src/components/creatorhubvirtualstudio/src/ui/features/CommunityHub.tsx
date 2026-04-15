// @ts-nocheck
import * as React from 'react';
import {
  Box,
  Button,
  List,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Stack,
  Typography,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  CloudUpload,
  Refresh,
  Download,
  Favorite,
  Share,
  LightMode,
  People,
} from '@mui/icons-material';
import type { CommunitySetup } from '../../core/services/community';
import { communityService } from '../../core/services/community';

export default function CommunityHub() {
  const [list, setList] = React.useState<CommunitySetup[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [uploadDialog, setUploadDialog] = React.useState(false);
  const [uploadTitle, setUploadTitle] = React.useState('');
  const [uploadDesc, setUploadDesc] = React.useState('');
  const [uploading, setUploading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const setups = await communityService.fetchCommunitySetups();
      setList(setups);
    } catch {
        window.dispatchEvent(new CustomEvent('vs-toast', {
          detail: { message: 'Failed to load community setups', severity: 'error' }
        }));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const handleUpload = async () => {
    if (!uploadTitle.trim()) return;
    
    setUploading(true);
    try {
      await communityService.uploadSetup({
        title: uploadTitle,
        description: uploadDesc,
        tags: [],
      });
      window.dispatchEvent(new CustomEvent('vs-toast', {
        detail: { message: 'Setup uploaded successfully', severity: 'success' }
      }));
      setUploadDialog(false);
      setUploadTitle('');
      setUploadDesc(', ');
      refresh();
    } catch {
      window.dispatchEvent(new CustomEvent('vs-toast', {
        detail: { message: 'Upload failed', severity: 'error' }
      }));
    } finally {
      setUploading(false);
    }
  };

  const handleLoadSetup = async (setup: CommunitySetup) => {
    try {
      await communityService.loadCommunitySetup(setup.id);
      window.dispatchEvent(new CustomEvent('vs-toast', {
        detail: { message: `Loaded "${setup.title}"`, severity: 'success' }
      }));
    } catch {
      window.dispatchEvent(new CustomEvent('vs-toast', {
        detail: { message: 'Failed to load setup', severity: 'error' }
      }));
    }
  };

  const handleLike = async (setupId: string) => {
    try {
      await communityService.likeSetup(setupId);
      refresh();
    } catch {
      // Silent fail for likes
    }
  };

  return (
    <Box sx={{ p: 1.5 }}>
      <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center" mb={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <People fontSize="small" />
          <Typography fontWeight={700}>Community</Typography>
        </Stack>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Share your setup">
            <IconButton size="small" onClick={() => setUploadDialog(true)}>
              <CloudUpload fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={refresh} disabled={loading}>
              <Refresh fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {loading ? (
        <Box display="flex" justifyContent="center" py={2}>
          <CircularProgress size={24} />
        </Box>
      ) : list.length === 0 ? (
        <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
          No community setups yet. Be the first to share!
        </Typography>
      ) : (
        <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
          {list.map((setup) => (
            <ListItemButton 
              key={setup.id} 
              onClick={() => handleLoadSetup(setup)}
              sx={{ borderRadius: 1, mb: 0.5 }}
            >
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                  <LightMode fontSize="small" />
                </Avatar>
              </ListItemAvatar>
              <ListItemText 
                primary={setup.title}
                secondary={
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Typography variant="caption">{setup.author}</Typography>
                    {setup.tags?.slice(0, 2).map(tag => (
                      <Chip key={tag} label={tag} size="small" sx={{ height: 16, fontSize: 10 }} />
                    ))}
                  </Stack>
                }
              />
              <Stack direction="row" spacing={0.5}>
                <Tooltip title="Like">
                  <IconButton 
                    size="small" 
                    onClick={(e) => { e.stopPropagation(); handleLike(setup.id); }}
                  >
                    <Favorite fontSize="small" color={setup.likes > 0 ? 'error' : 'inherit'} />
                  </IconButton>
                </Tooltip>
                <Typography variant="caption" sx={{ alignSelf: 'center' }}>
                  {setup.likes || 0}
                </Typography>
              </Stack>
            </ListItemButton>
          ))}
        </List>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialog} onClose={() => setUploadDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Share Your Setup</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Title"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="Description"
              value={uploadDesc}
              onChange={(e) => setUploadDesc(e.target.value)}
              fullWidth
              multiline
              rows={3}
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleUpload} 
            variant="contained"
            disabled={!uploadTitle.trim() || uploading}
            startIcon={uploading ? <CircularProgress size={16} /> : <CloudUpload />}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
