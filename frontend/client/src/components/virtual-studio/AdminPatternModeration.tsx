/**
 * Admin Pattern Moderation
 * 
 * Interface for admins to review and approve/reject user-submitted lighting patterns
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Typography,
  Grid,
  Chip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Stack,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Visibility,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface Pattern {
  id: string;
  name: string;
  description: string;
  look_description: string;
  category: string;
  difficulty_level: string;
  thumbnail_url: string;
  user_id: string;
  created_at: string;
  usage_count: number;
}

export const AdminPatternModeration: React.FC = () => {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPattern, setSelectedPattern] = useState<Pattern | null>(null);
  const [moderationNotes, setModerationNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchPendingPatterns();
  }, []);

  const fetchPendingPatterns = async () => {
    setLoading(true);
    try {
      const response = await apiRequest(
        , '/api/virtual-studio/custom-patterns/admin/pending'
      ) as { success: boolean; patterns: Pattern[] };

      if (response.success) {
        setPatterns(response.patterns);
      }
    } catch (error) {
      console.error('Error fetching pending patterns: ', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (patternId: string) => {
    setActionLoading(true);
    try {
      const response = await apiRequest(
        `/api/virtual-studio/custom-patterns/admin/${patternId}/approve`,
        {
          method: 'PUT',
          body: JSON.stringify({ moderationNotes }),
        }
      ) as { success: boolean; message: string };

      if (response.success) {
        alert(response.message);
        setPatterns(patterns.filter(p => p.id !== patternId));
        setSelectedPattern(null);
        setModerationNotes(', ');
      }
    } catch (error) {
      console.error('Error approving pattern:', error);
      alert('Failed to approve pattern');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (patternId: string) => {
    if (!moderationNotes.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setActionLoading(true);
    try {
      const response = await apiRequest(
        `/api/virtual-studio/custom-patterns/admin/${patternId}/reject`,
        {
          method: 'PUT',
          body: JSON.stringify({ moderationNotes }),
        }
      ) as { success: boolean; message: string };

      if (response.success) {
        alert(response.message);
        setPatterns(patterns.filter(p => p.id !== patternId));
        setSelectedPattern(null);
        setModerationNotes(', ');
      }
    } catch (error) {
      console.error('Error rejecting pattern:', error);
      alert('Failed to reject pattern');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Pattern Moderation
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review and approve user-submitted lighting patterns
      </Typography>

      {patterns.length === 0 ? (
        <Alert severity="info">No pending patterns to review</Alert>
      ) : (
        <Grid container spacing={2}>
          {patterns.map((pattern) => (
            <Grid item xs={12} sm={6} md={4} key={pattern.id}>
              <Card>
                {pattern.thumbnail_url && (
                  <Box
                    sx={{
                      width: '100%',
                      height: 200,
                      bgcolor: '#1a1a1a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'}}
                  >
                    <img
                      src={pattern.thumbnail_url}
                      alt={pattern.name}
                      style={{ maxWidth: '100%', maxHeight: '100%' }}
                    />
                  </Box>
                )}
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {pattern.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {pattern.look_description}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                    <Chip label={pattern.category} size="small" />
                    <Chip label={pattern.difficulty_level} size="small" color="primary" />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Submitted: {new Date(pattern.created_at).toLocaleDateString()}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    startIcon={<Visibility />}
                    onClick={() => setSelectedPattern(pattern)}
                  >
                    Review
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Review Dialog */}
      {selectedPattern && (
        <Dialog
          open={!!selectedPattern}
          onClose={() => setSelectedPattern(null)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>{selectedPattern.name}</DialogTitle>
          <DialogContent>
            <Stack spacing={2}>
              {selectedPattern.thumbnail_url && (
                <Box
                  sx={{
                    width: '100%',
                    bgcolor: '#1a1a1a',
                    p: 2,
                    borderRadius: 1,
                    display: 'flex',
                    justifyContent: 'center'}}
                >
                  <img
                    src={selectedPattern.thumbnail_url}
                    alt={selectedPattern.name}
                    style={{ maxWidth: '400px', maxHeight:'400px' }}
                  />
                </Box>
              )}

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Look Description
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedPattern.look_description}
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Full Description
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedPattern.description}
                </Typography>
              </Box>

              <Stack direction="row" spacing={1}>
                <Chip label={selectedPattern.category} />
                <Chip label={selectedPattern.difficulty_level} color="primary" />
              </Stack>

              <TextField
                label="Moderation Notes (optional for approval, required for rejection)"
                value={moderationNotes}
                onChange={(e) => setModerationNotes(e.target.value)}
                multiline
                rows={3}
                fullWidth
                placeholder="Add notes about this pattern..."
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSelectedPattern(null)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              color="error"
              startIcon={<Cancel />}
              onClick={() => handleReject(selectedPattern.id)}
              disabled={actionLoading || !moderationNotes.trim()}
            >
              Reject
            </Button>
            <Button
              color="success"
              variant="contained"
              startIcon={<CheckCircle />}
              onClick={() => handleApprove(selectedPattern.id)}
              disabled={actionLoading}
            >
              Approve
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};


