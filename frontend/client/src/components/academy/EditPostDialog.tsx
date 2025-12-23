import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Chip,
  Stack,
} from '@mui/material';
import {
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
	  History as HistoryIcon,
	} from '@mui/icons-material';
	import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';

interface EditPostDialogProps {
  open: boolean;
  onClose: () => void;
  post: any; // The published post to edit
  onSuccess?: () => void;
}

function EditPostDialog({
  open,
  onClose,
  post,
  onSuccess,
}: EditPostDialogProps) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [editHistory, setEditHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (open && post) {
      setMessage(post.instructor_message || '');
      setSuccess(false);
      fetchEditHistory();
    }
  }, [open, post]);

  const fetchEditHistory = async () => {
    if (!post) return;
    
    try {
      const response = await fetch(
        `/api/academy/courses/${post.course_id}/community-posts/${post.id}/history`,
        { credentials: 'include' }
      );
      const data = await response.json();
      if (response.ok) {
        setEditHistory(data.history || []);
      }
    } catch (error) {
      console.error('Error fetching edit history: ', error);
    }
  };

  const handleSave = async () => {
    if (!message.trim()) {
      alert('Meldingen kan ikke være tom');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/academy/courses/${post.course_id}/community-posts/${post.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type' : 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            instructorMessage: message.trim(),
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update post');
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error('Error updating post:', error);
      alert(error.message || 'Kunne ikke oppdatere innlegget');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Er du sikker på at du vil slette dette innlegget? Dette kan ikke angres.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/academy/courses/${post.course_id}/community-posts/${post.id}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete post');
      }

      alert('Innlegget er slettet');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Error deleting post:', error);
      alert(error.message || 'Kunne ikke slette innlegget');
    } finally {
      setLoading(false);
    }
  };

	  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <EditIcon color="primary" />
          <Typography variant="h6">Rediger Innlegg</Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {success ? (
          <Alert severity="success" icon={<CheckCircleIcon />}>
            <Typography variant="h6" gutterBottom>
              Innlegget er oppdatert!
            </Typography>
            <Typography variant="body2">
              Endringene er nå synlige i community.
            </Typography>
          </Alert>
        ) : (
          <Stack spacing={3}>
            {/* Course Info */}
            {post && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Kurs:
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {post.course_title || 'Ukjent kurs'}
                </Typography>
                <Chip
                  label={`Publisert ${new Date(post.published_at).toLocaleDateString('nb-NO')}`}
                  size="small"
                  sx={{ mt: 1 }}
                />
                {post.edit_count > 0 && (
                  <Chip
                    label={`Redigert ${post.edit_count} ${post.edit_count === 1 ? 'gang' : 'ganger'}`}
                    size="small"
                    color="warning"
                    sx={{ mt: 1, ml: 1 }}
                  />
                )}
              </Box>
            )}

            {/* Message Editor */}
            <TextField
              label="Din melding til community"
              multiline
              rows={8}
              fullWidth
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Skriv din melding her..."
              helperText="Oppdater meldingen din. Den originale kursinformasjonen forblir uendret."
            />

            {/* Edit History */}
            {editHistory.length > 0 && (
              <Box>
                <Button
                  startIcon={<HistoryIcon />}
                  onClick={() => setShowHistory(!showHistory)}
                  size="small"
                >
                  {showHistory ? 'Skjul' : 'Vis'} redigeringshistorikk ({editHistory.length})
                </Button>
                {showHistory && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                    <Stack spacing={1}>
                      {editHistory.map((edit, index) => (
                        <Box key={edit.id} sx={{ pb: 1, borderBottom: index < editHistory.length - 1 ? 1 : 0, borderColor: 'divider' }}>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(edit.edited_at).toLocaleString('nb-NO')}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            {edit.previous_message}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        {!success && (
          <>
            <Button onClick={handleDelete} color="error" disabled={loading}>
              Slett innlegg
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button onClick={onClose} disabled={loading}>
              Avbryt
            </Button>
            <Button
              onClick={handleSave}
              variant="contained"
              disabled={loading || !message.trim()}
              startIcon={loading ? <CircularProgress size={20} /> : <EditIcon />}
            >
              {loading ? 'Lagrer...' : 'Lagre endringer'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
	  );
	}

	export default withUniversalIntegration(EditPostDialog, {
	  componentId: 'edit-post-dialog',
	  componentName: 'Edit Post Dialog',
	  componentType: 'modal',
	  componentCategory:'academy',
	  featureIds: ['community-posts', 'post-management'],
	});
