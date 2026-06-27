import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Avatar,
  Badge,
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  Comment as CommentIcon,
  ErrorOutline as ErrorOutlineIcon,
  HourglassEmpty as HourglassEmptyIcon,
  PublishedWithChanges as PublishedWithChangesIcon,
  RateReview as RateReviewIcon,
  RemoveRedEye as RemoveRedEyeIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { QUERY_KEYS } from '@/lib/queryKeys';
import { useToast } from '@/hooks/use-toast';
import { AdminButton, StatusChip, AdminLoading, AdminEmpty, useIsMobile } from './design-system';

export type ApprovalStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'published';
export type ApprovalRole = 'creator' | 'reviewer' | 'approver';

interface ApprovalRequest {
  id: string;
  contentType: 'social' | 'email' | 'announcement';
  contentId: string;
  title: string;
  status: ApprovalStatus;
  createdBy: {
    id: string;
    name: string;
    role: string;
  };
  currentStage: number;
  totalStages: number;
  createdAt: string;
  updatedAt: string;
  preview?: unknown;
}

interface ApprovalStage {
  id: string;
  requestId: string;
  stage: number;
  role: ApprovalRole;
  assignedTo?: {
    id: string;
    name: string;
  };
  status: ApprovalStatus;
  comments?: string;
  reviewedAt?: string;
  reviewedBy?: {
    id: string;
    name: string;
  };
}

interface ApprovalComment {
  id: string;
  requestId: string;
  userId: string;
  userName: string;
  userRole: string;
  comment: string;
  createdAt: string;
}

type RequestTab = 'pending' | 'in_review' | 'approved' | 'all';

const STATUS_META: Record<
  ApprovalStatus,
  {
    label: string;
    color: 'default' | 'info' | 'success' | 'error';
    tone: 'neutral' | 'info' | 'success' | 'error';
    icon: React.ReactElement;
  }
> = {
  pending: { label: 'Pending', color: 'default', tone: 'neutral', icon: <HourglassEmptyIcon fontSize="small" /> },
  in_review: { label: 'In Review', color: 'info', tone: 'info', icon: <RateReviewIcon fontSize="small" /> },
  approved: { label: 'Approved', color: 'success', tone: 'success', icon: <CheckCircleIcon fontSize="small" /> },
  rejected: { label: 'Rejected', color: 'error', tone: 'error', icon: <CloseIcon fontSize="small" /> },
  published: { label: 'Published', color: 'success', tone: 'success', icon: <PublishedWithChangesIcon fontSize="small" /> },
};

export default function ApprovalWorkflow() {
  const [selectedTab, setSelectedTab] = useState<RequestTab>('pending');
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const requestsQuery = useQuery({
    queryKey: [...QUERY_KEYS.APPROVALS, selectedTab],
    queryFn: async () => {
      const params = selectedTab !== 'all' ? `?status=${selectedTab}` : '';
      const response = await fetch(`/api/approvals${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch approval requests');
      }
      return (await response.json()) as ApprovalRequest[];
    },
  });

  const stagesQuery = useQuery({
    queryKey: [...QUERY_KEYS.APPROVAL_STAGES, selectedRequest?.id],
    queryFn: async () => {
      if (!selectedRequest?.id) {
        return [];
      }
      const response = await fetch(`/api/approvals/${selectedRequest.id}/stages`);
      if (!response.ok) {
        throw new Error('Failed to fetch approval stages');
      }
      return (await response.json()) as ApprovalStage[];
    },
    enabled: Boolean(selectedRequest?.id),
  });

  const commentsQuery = useQuery({
    queryKey: [...QUERY_KEYS.APPROVAL_COMMENTS, selectedRequest?.id],
    queryFn: async () => {
      if (!selectedRequest?.id) {
        return [];
      }
      const response = await fetch(`/api/approvals/${selectedRequest.id}/comments`);
      if (!response.ok) {
        throw new Error('Failed to fetch approval comments');
      }
      return (await response.json()) as ApprovalComment[];
    },
    enabled: Boolean(selectedRequest?.id),
  });

  const requests = Array.isArray(requestsQuery.data) ? requestsQuery.data : [];
  const stages = Array.isArray(stagesQuery.data) ? stagesQuery.data : [];
  const comments = Array.isArray(commentsQuery.data) ? commentsQuery.data : [];

  const approveMutation = useMutation({
    mutationFn: async ({ requestId, comment }: { requestId: string; comment?: string }) => {
      const response = await fetch(`/api/approvals/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      });
      if (!response.ok) {
        throw new Error('Failed to approve request');
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.APPROVALS });
      toast({ title: 'Content approved', description: 'The request has been approved.', variant: 'success' });
      setReviewComment('');
      setSelectedRequest(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, comment }: { requestId: string; comment: string }) => {
      const response = await fetch(`/api/approvals/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      });
      if (!response.ok) {
        throw new Error('Failed to reject request');
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.APPROVALS });
      toast({ title: 'Content rejected', description: 'The request has been rejected.', variant: 'warning' });
      setReviewComment('');
      setSelectedRequest(null);
    },
  });

  const requestChangesMutation = useMutation({
    mutationFn: async ({ requestId, comment }: { requestId: string; comment: string }) => {
      const response = await fetch(`/api/approvals/${requestId}/request-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      });
      if (!response.ok) {
        throw new Error('Failed to request changes');
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.APPROVALS });
      toast({ title: 'Changes requested', description: 'Feedback was sent to the creator.', variant: 'info' });
      setReviewComment('');
      setSelectedRequest(null);
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ requestId, comment }: { requestId: string; comment: string }) => {
      const response = await fetch(`/api/approvals/${requestId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      });
      if (!response.ok) {
        throw new Error('Failed to add comment');
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...QUERY_KEYS.APPROVAL_COMMENTS, selectedRequest?.id],
      });
      setReviewComment('');
    },
  });

  const counters = useMemo(() => {
    return {
      pending: requests.filter((request) => request.status === 'pending').length,
      inReview: requests.filter((request) => request.status === 'in_review').length,
      approved: requests.filter((request) => request.status === 'approved').length,
    };
  }, [requests]);

  const filteredRequests =
    selectedTab === 'all' ? requests : requests.filter((request) => request.status === selectedTab);

  const handleApprove = () => {
    if (!selectedRequest) {
      return;
    }
    approveMutation.mutate({
      requestId: selectedRequest.id,
      comment: reviewComment.trim() || undefined,
    });
  };

  const handleReject = () => {
    if (!selectedRequest || !reviewComment.trim()) {
      return;
    }
    rejectMutation.mutate({
      requestId: selectedRequest.id,
      comment: reviewComment.trim(),
    });
  };

  const handleRequestChanges = () => {
    if (!selectedRequest || !reviewComment.trim()) {
      return;
    }
    requestChangesMutation.mutate({
      requestId: selectedRequest.id,
      comment: reviewComment.trim(),
    });
  };

  const handleAddComment = () => {
    if (!selectedRequest || !reviewComment.trim()) {
      return;
    }
    addCommentMutation.mutate({
      requestId: selectedRequest.id,
      comment: reviewComment.trim(),
    });
  };

  const handleTabChange = (_event: React.SyntheticEvent, value: RequestTab) => {
    setSelectedTab(value);
  };

  const contentTypeColor = (contentType: ApprovalRequest['contentType']) => {
    if (contentType === 'social') return 'info';
    if (contentType === 'email') return 'secondary';
    return 'success';
  };

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box>
        <Typography variant="h4" component="h2" sx={{ fontWeight: 700 }}>
          Approval Workflow
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Review and approve content before publishing.
        </Typography>
      </Box>

      <Card>
        <CardContent sx={{ pb: 1 }}>
          <Tabs value={selectedTab} onChange={handleTabChange}>
            <Tab
              value="pending"
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>Pending</span>
                  {counters.pending > 0 && <Badge color="default" badgeContent={counters.pending} />}
                </Stack>
              }
            />
            <Tab
              value="in_review"
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>In Review</span>
                  {counters.inReview > 0 && <Badge color="primary" badgeContent={counters.inReview} />}
                </Stack>
              }
            />
            <Tab
              value="approved"
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>Approved</span>
                  {counters.approved > 0 && <Badge color="success" badgeContent={counters.approved} />}
                </Stack>
              }
            />
            <Tab value="all" label="All" />
          </Tabs>
        </CardContent>
      </Card>

      {requestsQuery.isLoading ? (
        <AdminLoading label="Loading approval requests..." />
      ) : filteredRequests.length === 0 ? (
        <AdminEmpty title="No approval requests found." />
      ) : (
        <Stack spacing={2}>
          {filteredRequests.map((request) => {
            return (
              <Card key={request.id}>
                <CardHeader
                  title={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip label={request.contentType} color={contentTypeColor(request.contentType)} size="small" />
                      <Typography variant="h6">{request.title}</Typography>
                    </Stack>
                  }
                  subheader={
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Typography variant="caption">By: {request.createdBy.name}</Typography>
                      <Typography variant="caption">
                        {new Date(request.createdAt).toLocaleDateString()}
                      </Typography>
                      <StatusChip
                        tone={STATUS_META[request.status].tone}
                        label={STATUS_META[request.status].label}
                      />
                    </Stack>
                  }
                  action={
                    <Tooltip title="Review request">
                      <IconButton aria-label="Gjennomgå forespørsel" onClick={() => setSelectedRequest(request)}>
                        <RemoveRedEyeIcon />
                      </IconButton>
                    </Tooltip>
                  }
                />
                <CardContent sx={{ pt: 0 }}>
                  <Typography variant="body2" color="text.secondary">
                    Stage {request.currentStage} of {request.totalStages} | Updated{' '}
                    {new Date(request.updatedAt).toLocaleDateString()}
                  </Typography>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      <Dialog
        open={Boolean(selectedRequest)}
        onClose={() => {
          setSelectedRequest(null);
          setReviewComment('');
        }}
        fullWidth
        maxWidth="lg"
        fullScreen={isMobile}
      >
        <DialogTitle>{selectedRequest?.title || 'Review request'}</DialogTitle>
        <DialogContent dividers>
          {selectedRequest && (
            <Stack spacing={3}>
              <Box>
                <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                  Approval Stages
                </Typography>
                <Grid container spacing={1}>
                  {stages.map((stage) => (
                    <Grid item xs={12} sm={6} md={4} key={stage.id}>
                      <Card variant="outlined">
                        <CardContent>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>
                              {stage.role}
                            </Typography>
                            <StatusChip
                              tone={STATUS_META[stage.status].tone}
                              label={STATUS_META[stage.status].label}
                            />
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {stage.assignedTo?.name || 'Unassigned'}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                  {stages.length === 0 && (
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">
                        No stage data available for this request.
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>

              <Box>
                <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                  Preview
                </Typography>
                <Card variant="outlined">
                  <CardContent sx={{ maxHeight: 260, overflow: 'auto' }}>
                    {selectedRequest.preview ? (
                      <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(selectedRequest.preview, null, 2)}
                      </pre>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No preview available.
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Box>

              <Box>
                <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                  Comments
                </Typography>
                <Stack spacing={1.5} sx={{ mb: 2 }}>
                  {comments.map((comment) => (
                    <Box key={comment.id} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                      <Avatar>{comment.userName.slice(0, 2).toUpperCase()}</Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle2">{comment.userName}</Typography>
                          <Chip label={comment.userRole} size="small" variant="outlined" />
                          <Typography variant="caption" color="text.secondary">
                            {new Date(comment.createdAt).toLocaleString()}
                          </Typography>
                        </Stack>
                        <Typography variant="body2">{comment.comment}</Typography>
                      </Box>
                    </Box>
                  ))}
                  {comments.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No comments yet.
                    </Typography>
                  )}
                </Stack>
                <TextField
                  label="Review comment"
                  multiline
                  minRows={3}
                  fullWidth
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.target.value)}
                />
                <Box sx={{ mt: 1 }}>
                  <AdminButton
                    tone="secondary"
                    startIcon={<CommentIcon />}
                    onClick={handleAddComment}
                    loading={addCommentMutation.isPending}
                    disabled={!reviewComment.trim()}
                  >
                    Add comment
                  </AdminButton>
                </Box>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1, justifyContent: 'space-between' }}>
          <AdminButton
            tone="ghost"
            onClick={() => {
              setSelectedRequest(null);
              setReviewComment('');
            }}
          >
            Close
          </AdminButton>
          {selectedRequest && (selectedRequest.status === 'pending' || selectedRequest.status === 'in_review') ? (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <AdminButton
                tone="primary"
                startIcon={<CheckCircleIcon />}
                onClick={handleApprove}
                loading={approveMutation.isPending}
              >
                Approve
              </AdminButton>
              <AdminButton
                tone="secondary"
                startIcon={<ErrorOutlineIcon />}
                onClick={handleRequestChanges}
                loading={requestChangesMutation.isPending}
                disabled={!reviewComment.trim()}
              >
                Request changes
              </AdminButton>
              <AdminButton
                tone="danger"
                startIcon={<SendIcon />}
                onClick={handleReject}
                loading={rejectMutation.isPending}
                disabled={!reviewComment.trim()}
              >
                Reject
              </AdminButton>
            </Stack>
          ) : (
            <Chip label={`Request is ${selectedRequest?.status || 'closed'}`} />
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
