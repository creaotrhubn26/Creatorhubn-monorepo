/**
 * Split Sheet EaseVerse Integration
 * Component for linking/unlinking split sheets with EaseVerse tracks and projects
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Tooltip,
  Snackbar
} from '@mui/material';
import {
  Link as LinkIcon,
  LinkOff as UnlinkIcon,
  Add as AddIcon,
  MusicNote as MusicIcon,
  AccountBalance as SplitSheetIcon
} from '@mui/icons-material';
import type { SplitSheet, SplitSheetEaseVerseLink } from './types';

interface SplitSheetSongFlowIntegrationProps {
  splitSheetId: string;
  onLinkCreated?: () => void;
}

export default function SplitSheetSongFlowIntegration({
  splitSheetId,
  onLinkCreated
}: SplitSheetSongFlowIntegrationProps) {
  const queryClient = useQueryClient();
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [easeverseTrackId, setEaseverseTrackId] = useState('');
  const [easeverseProjectId, setEaseverseProjectId] = useState('');
  const [confirmUnlink, setConfirmUnlink] = useState<SplitSheetEaseVerseLink | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'info' | 'warning' | 'error' }>({ open: false, message: '', severity: 'info' });

  // Fetch existing links
  const { data: linksData } = useQuery({
    queryKey: ['split-sheet-easeverse-links', splitSheetId],
    queryFn: async () => {
      const response = await apiRequest(`/api/split-sheets/${splitSheetId}/easeverse`);
      return response;
    }
  });

  const links: SplitSheetEaseVerseLink[] = linksData?.data || [];

  // Link mutation
  const linkMutation = useMutation({
    mutationFn: async (data: { easeverseTrackId?: string; easeverseProjectId?: string }) => {
      await apiRequest(`/api/split-sheets/${splitSheetId}/link-easeverse`, {
        method: 'POST',
        body: data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['split-sheet-easeverse-links', splitSheetId] });
      queryClient.invalidateQueries({ queryKey: ['split-sheet', splitSheetId] });
      setShowLinkDialog(false);
      setEaseverseTrackId('');
      setEaseverseProjectId('');
      if (onLinkCreated) onLinkCreated();
    }
  });

  // Unlink mutation
  const unlinkMutation = useMutation({
    mutationFn: async (params: { easeverseTrackId?: string; easeverseProjectId?: string }) => {
      const queryParams = new URLSearchParams();
      if (params.easeverseTrackId) queryParams.append('easeverseTrackId', params.easeverseTrackId);
      if (params.easeverseProjectId) queryParams.append('easeverseProjectId', params.easeverseProjectId);
      
      await apiRequest(`/api/split-sheets/${splitSheetId}/unlink-easeverse?${queryParams.toString()}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['split-sheet-easeverse-links', splitSheetId] });
      queryClient.invalidateQueries({ queryKey: ['split-sheet', splitSheetId] });
    }
  });

  const handleLink = () => {
    if (!easeverseTrackId && !easeverseProjectId) {
      setSnackbar({ open: true, message: 'Vennligst oppgi enten EaseVerse track ID eller project ID', severity: 'warning' });
      return;
    }
    linkMutation.mutate({
      easeverseTrackId: easeverseTrackId || undefined,
      easeverseProjectId: easeverseProjectId || undefined
    });
  };

  const handleUnlink = (link: SplitSheetEaseVerseLink) => {
    setConfirmUnlink(link);
  };

  const executeUnlink = () => {
    if (!confirmUnlink) return;
    unlinkMutation.mutate({
      easeverseTrackId:
        confirmUnlink.easeverseTrackId ||
        confirmUnlink.easeverse_track_id ||
        confirmUnlink.songflow_track_id ||
        undefined,
      easeverseProjectId:
        confirmUnlink.easeverseProjectId ||
        confirmUnlink.easeverse_project_id ||
        confirmUnlink.songflow_project_id ||
        undefined
    });
    setConfirmUnlink(null);
  };

  return (
    <Box>
      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                <MusicIcon sx={{ color: '#9f7aea' }} />
                EaseVerse Integrasjon
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Koble split sheet til EaseVerse tracks eller prosjekter
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<LinkIcon />}
              onClick={() => setShowLinkDialog(true)}
            >
              Koble til EaseVerse
            </Button>
          </Stack>

          {links.length === 0 ? (
            <Alert severity="info">
              Ingen EaseVerse-koblinger. Koble til en EaseVerse track eller prosjekt for å synkronisere data.
            </Alert>
          ) : (
            <List>
              {links.map((link, index) => (
                <React.Fragment key={link.id || index}>
                  <ListItem>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            label={(link.linkType || link.link_type) === 'track' ? 'Track' : 'Prosjekt'}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                          {(link.easeverseTrackId || link.easeverse_track_id || link.songflow_track_id) && (
                            <Typography variant="body2">
                              Track ID: {link.easeverseTrackId || link.easeverse_track_id || link.songflow_track_id}
                            </Typography>
                          )}
                          {(link.easeverseProjectId || link.easeverse_project_id || link.songflow_project_id) && (
                            <Typography variant="body2">
                              Prosjekt ID: {link.easeverseProjectId || link.easeverse_project_id || link.songflow_project_id}
                            </Typography>
                          )}
                          {(link.autoCreated || link.auto_created) && (
                            <Chip
                              label="Auto-opprettet"
                              size="small"
                              color="success"
                              variant="outlined"
                            />
                          )}
                        </Stack>
                      }
                      secondary={
                        (link.linkedAt || link.linked_at)
                          ? `Koblet: ${new Date(link.linkedAt || (link.linked_at as string)).toLocaleDateString('no-NO')}`
                          : undefined
                      }
                    />
                    <ListItemSecondaryAction>
                      <Tooltip title="Fjern kobling">
                        <IconButton
                          edge="end"
                          onClick={() => handleUnlink(link)}
                          color="error"
                        >
                          <UnlinkIcon />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < links.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Link Dialog */}
      <Dialog
        open={showLinkDialog}
        onClose={() => {
          setShowLinkDialog(false);
          setEaseverseTrackId('');
          setEaseverseProjectId('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Koble til EaseVerse</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              Oppgi enten EaseVerse track ID eller prosjekt ID for å koble til split sheet.
            </Alert>
            <TextField
              label="EaseVerse Track ID (valgfritt)"
              value={easeverseTrackId}
              onChange={(e) => setEaseverseTrackId(e.target.value)}
              fullWidth
              placeholder="f.eks. track_123"
            />
            <TextField
              label="EaseVerse Prosjekt ID (valgfritt)"
              value={easeverseProjectId}
              onChange={(e) => setEaseverseProjectId(e.target.value)}
              fullWidth
              placeholder="f.eks. project_456"
            />
            <Alert severity="warning">
              Du må oppgi minst én ID (track eller prosjekt).
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowLinkDialog(false);
            setEaseverseTrackId('');
            setEaseverseProjectId('');
          }}>
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={handleLink}
            disabled={linkMutation.isPending || (!easeverseTrackId && !easeverseProjectId)}
            sx={{ bgcolor: '#9f7aea' }}
          >
            {linkMutation.isPending ? 'Kobler...' : 'Koble til'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Unlink Dialog */}
      <Dialog open={!!confirmUnlink} onClose={() => setConfirmUnlink(null)}>
        <DialogTitle>Bekreft frakobling</DialogTitle>
        <DialogContent>
          <Typography>
            Er du sikker på at du vil fjerne koblingen til EaseVerse? Du kan koble til igjen senere.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmUnlink(null)}>Avbryt</Button>
          <Button onClick={executeUnlink} color="error" variant="contained">Fjern kobling</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}





















