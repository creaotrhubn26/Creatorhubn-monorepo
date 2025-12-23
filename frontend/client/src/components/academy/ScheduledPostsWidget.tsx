import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  Button,
  Alert,
  LinearProgress,
  IconButton,
  Tooltip,
  Avatar,
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
	  Pending as PendingIcon,
	} from '@mui/icons-material';
	import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';

function ScheduledPostsWidget() {
  const [loading, setLoading] = useState(true);
  const [scheduledPosts, setScheduledPosts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchScheduledPosts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/academy/scheduled-posts', {
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        setScheduledPosts(data.scheduledPosts || []);
      } else {
        setError(data.error || 'Failed to load scheduled posts');
      }
    } catch (err: any) {
      console.error('Error fetching scheduled posts: ', err);
      setError('Failed to load scheduled posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScheduledPosts();
  }, []);

  const handleCancelPost = async (postId: string) => {
    if (!confirm('Er du sikker på at du vil avbryte denne planlagte publiseringen?')) {
      return;
    }

    try {
      const response = await fetch(`/api/academy/scheduled-posts/${postId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        fetchScheduledPosts();
      } else {
        const data = await response.json();
        alert(data.error || 'Kunne ikke avbryte innlegget');
      }
    } catch (error) {
      console.error('Error cancelling post:', error);
      alert('Kunne ikke avbryte innlegget');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <PendingIcon color="warning" />;
      case 'published':
        return <CheckCircleIcon color="success" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'cancelled':
        return <DeleteIcon color="disabled" />;
      default:
        return <ScheduleIcon />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Venter';
      case 'published':
        return 'Publisert';
      case 'failed':
        return 'Feilet';
      case 'cancelled':
        return 'Avbrutt';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Planlagte innlegg
          </Typography>
          <LinearProgress />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  const pendingPosts = scheduledPosts.filter(p => p.status === 'pending');
  const otherPosts = scheduledPosts.filter(p => p.status !== 'pending');

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Planlagte innlegg ({pendingPosts.length})
          </Typography>
          <Tooltip title="Oppdater">
            <IconButton size="small" onClick={fetchScheduledPosts}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {scheduledPosts.length === 0 ? (
          <Alert severity="info">
            Ingen planlagte innlegg. Bruk "Planlegg publisering" når du publiserer et kurs.
          </Alert>
        ) : (
          <Stack spacing={2}>
            {/* Pending Posts */}
            {pendingPosts.length > 0 && (
              <>
                <Typography variant="subtitle2" color="text.secondary">
                  Venter på publisering
                </Typography>
                {pendingPosts.map((post) => (
                  <Box
                    key={post.id}
                    p={2}
                    bgcolor="warning.50"
                    borderRadius={1}
                    border={1}
                    borderColor="warning.200"
                  >
                    <Stack spacing={1}>
                      <Box display="flex" alignItems="center" gap={2}>
                        {post.course_thumbnail && (
                          <Avatar
                            src={post.course_thumbnail}
                            variant="rounded"
                            sx={{ width: 50, height: 50 }}
                          />
                        )}
                        <Box flex={1}>
                          <Typography variant="body1" fontWeight={600}>
                            {post.course_title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {post.channel_ids?.length || 0} kanaler
                          </Typography>
                        </Box>
                        {getStatusIcon(post.status)}
                      </Box>

                      <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
                        <Chip
                          icon={<ScheduleIcon />}
                          label={new Date(post.scheduled_for).toLocaleString('nb-NO')}
                          size="small"
                          color="warning"
                        />
                        <Chip
                          label={getStatusLabel(post.status)}
                          size="small"
                          color="warning"
                        />
                      </Box>

                      <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleCancelPost(post.id)}
                      >
                        Avbryt publisering
                      </Button>
                    </Stack>
                  </Box>
                ))}
              </>
            )}

            {/* Other Posts (Published, Failed, Cancelled) */}
            {otherPosts.length > 0 && (
              <>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>
                  Historikk
                </Typography>
                {otherPosts.slice(0, 5).map((post) => (
                  <Box
                    key={post.id}
                    p={1.5}
                    bgcolor="background.default"
                    borderRadius={1}
                  >
                    <Box display="flex" alignItems="center" gap={2}>
                      <Box flex={1}>
                        <Typography variant="body2" fontWeight={600}>
                          {post.course_title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Planlagt: {new Date(post.scheduled_for).toLocaleString('nb-NO')}
                        </Typography>
                      </Box>
                      <Chip
                        label={getStatusLabel(post.status)}
                        size="small"
                        color={
                          post.status === 'published' ? 'success' :
                          post.status === 'failed' ? 'error' : 'default'
                        }
                      />
                    </Box>
                    {post.error_message && (
                      <Alert severity="error" sx={{ mt: 1 }}>
                        {post.error_message}
                      </Alert>
                    )}
                  </Box>
                ))}
              </>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

export default withUniversalIntegration(ScheduledPostsWidget, {
  componentId: 'scheduled-posts-widget',
  componentName: 'Scheduled Posts Widget',
  componentType: 'widget',
  componentCategory:'academy',
  featureIds: ['post-scheduling', 'community-posts', 'analytics-academy'],
});
