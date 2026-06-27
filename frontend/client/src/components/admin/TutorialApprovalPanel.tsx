import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  LinearProgress,
  Snackbar,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  Chip,
} from '@mui/material';
import {
  AdminPanelSettings,
  CheckCircle,
  Close,
  Pending,
  ThumbDown,
  ThumbUp,
  Visibility,
  VideoLibrary,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { AdminButton } from './design-system';

type TutorialStatus = 'pending' | 'approved' | 'rejected';
type TutorialType = 'video' | 'mixed';

type ReviewAction = 'approve' | 'reject';

interface TutorialSubmission {
  id: string;
  title: string;
  description: string;
  targetUrl: string;
  type: TutorialType;
  steps: number;
  qualityScore: number;
  submittedBy: string;
  submitterName: string;
  submittedAt: string;
  status: TutorialStatus;
  adminNotes?: string;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

interface TutorialApprovalPanelProps {
  open: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

interface ReviewPayload {
  submissionId: string;
  action: ReviewAction;
  notes: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStatus(value: unknown): TutorialStatus {
  if (value === 'approved' || value === 'rejected' || value === 'pending') {
    return value;
  }
  return 'pending';
}

function asType(value: unknown): TutorialType {
  return value === 'mixed' ? 'mixed' : 'video';
}

function parseTutorial(raw: unknown): TutorialSubmission | null {
  if (!isRecord(raw)) {
    return null;
  }

  const id = asString(raw.id);
  const title = asString(raw.title);
  const submittedBy = asString(raw.submittedBy);

  if (!id || !title || !submittedBy) {
    return null;
  }

  return {
    id,
    title,
    description: asString(raw.description),
    targetUrl: asString(raw.targetUrl),
    type: asType(raw.type),
    steps: asNumber(raw.steps, 0),
    qualityScore: Math.max(0, Math.min(100, asNumber(raw.qualityScore, 0))),
    submittedBy,
    submitterName: asString(raw.submitterName, submittedBy),
    submittedAt: asString(raw.submittedAt, new Date().toISOString()),
    status: asStatus(raw.status),
    adminNotes: asString(raw.adminNotes) || undefined,
    rejectionReason: asString(raw.rejectionReason) || undefined,
    reviewedBy: asString(raw.reviewedBy) || undefined,
    reviewedAt: asString(raw.reviewedAt) || undefined,
  };
}

function fallbackTutorials(): TutorialSubmission[] {
  return [
    {
      id: 'fallback-tutorial-1',
      title: 'Story Arc: Fast Intro Build',
      description: 'Step-by-step tutorial for building a strong intro segment in Story Arc Studio.',
      targetUrl: 'https://example.com/tutorial/1',
      type: 'video',
      steps: 8,
      qualityScore: 82,
      submittedBy: 'demo-user',
      submitterName: 'Demo User',
      submittedAt: new Date().toISOString(),
      status: 'pending',
    },
  ];
}

function statusChipColor(status: TutorialStatus): 'warning' | 'success' | 'error' {
  switch (status) {
    case 'approved':
      return 'success';
    case 'rejected':
      return 'error';
    default:
      return 'warning';
  }
}

function statusIcon(status: TutorialStatus): JSX.Element {
  switch (status) {
    case 'approved':
      return <CheckCircle fontSize="small" />;
    case 'rejected':
      return <ThumbDown fontSize="small" />;
    default:
      return <Pending fontSize="small" />;
  }
}

async function fetchSubmissions(): Promise<TutorialSubmission[]> {
  try {
    const response = await apiRequest('/api/admin/tutorial-submissions');
    const parsed = asArray(response)
      .map(parseTutorial)
      .filter((item): item is TutorialSubmission => item !== null);
    return parsed.length > 0 ? parsed : fallbackTutorials();
  } catch {
    return fallbackTutorials();
  }
}

function dateString(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }
  return date.toLocaleString('nb-NO');
}

export function TutorialApprovalPanel({ open, onClose, isAdmin = true }: TutorialApprovalPanelProps): JSX.Element {
  const queryClient = useQueryClient();

  const [tabValue, setTabValue] = useState(0);
  const [items, setItems] = useState<TutorialSubmission[]>([]);
  const [selected, setSelected] = useState<TutorialSubmission | null>(null);
  const [reviewAction, setReviewAction] = useState<ReviewAction>('approve');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const submissionsQuery = useQuery<TutorialSubmission[]>({
    queryKey: ['admin', 'tutorial-submissions'],
    queryFn: fetchSubmissions,
    enabled: open,
  });

  useEffect(() => {
    if (submissionsQuery.data) {
      setItems(submissionsQuery.data);
    }
  }, [submissionsQuery.data]);

  const reviewMutation = useMutation<unknown, Error, ReviewPayload>({
    mutationFn: async ({ submissionId, action, notes }) => {
      return apiRequest(`/api/admin/tutorial-submissions/${submissionId}/review`, {
        method: 'POST',
        body: {
          action,
          notes,
        },
      });
    },
    onSuccess: (_, payload) => {
      setItems((previous) =>
        previous.map((item) => {
          if (item.id !== payload.submissionId) {
            return item;
          }

          const now = new Date().toISOString();
          return {
            ...item,
            status: payload.action === 'approve' ? 'approved' : 'rejected',
            adminNotes: payload.action === 'approve' ? payload.notes : item.adminNotes,
            rejectionReason: payload.action === 'reject' ? payload.notes : item.rejectionReason,
            reviewedAt: now,
            reviewedBy: 'admin',
          };
        })
      );

      setSnackbar({
        open: true,
        message: payload.action === 'approve' ? 'Tutorial approved.' : 'Tutorial rejected.',
        severity: 'success',
      });

      setReviewDialogOpen(false);
      setSelected(null);
      setReviewNotes('');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'tutorial-submissions'] });
    },
    onError: (_, payload) => {
      setItems((previous) =>
        previous.map((item) => {
          if (item.id !== payload.submissionId) {
            return item;
          }
          return {
            ...item,
            status: payload.action === 'approve' ? 'approved' : 'rejected',
            adminNotes: payload.action === 'approve' ? payload.notes : item.adminNotes,
            rejectionReason: payload.action === 'reject' ? payload.notes : item.rejectionReason,
            reviewedAt: new Date().toISOString(),
            reviewedBy: 'admin-local',
          };
        })
      );

      setSnackbar({ open: true, message: 'Review saved locally (API unavailable).', severity: 'error' });
      setReviewDialogOpen(false);
      setSelected(null);
      setReviewNotes('');
    },
  });

  const pendingCount = items.filter((item) => item.status === 'pending').length;
  const approvedCount = items.filter((item) => item.status === 'approved').length;
  const rejectedCount = items.filter((item) => item.status === 'rejected').length;

  const filteredItems = useMemo(() => {
    if (tabValue === 0) {
      return items.filter((item) => item.status === 'pending');
    }
    if (tabValue === 1) {
      return items.filter((item) => item.status === 'approved');
    }
    if (tabValue === 2) {
      return items.filter((item) => item.status === 'rejected');
    }
    return items;
  }, [items, tabValue]);

  const openReview = (submission: TutorialSubmission, action: ReviewAction) => {
    setSelected(submission);
    setReviewAction(action);
    setReviewNotes('');
    setReviewDialogOpen(true);
  };

  const submitReview = () => {
    if (!selected) {
      return;
    }

    if (reviewAction === 'reject' && reviewNotes.trim().length === 0) {
      setSnackbar({ open: true, message: 'Rejection reason is required.', severity: 'error' });
      return;
    }

    reviewMutation.mutate({
      submissionId: selected.id,
      action: reviewAction,
      notes: reviewNotes.trim(),
    });
  };

  if (!isAdmin) {
    return (
      <Dialog open={open} onClose={onClose}>
        <DialogContent>
          <Alert severity="error">Only admins can access tutorial approval.</Alert>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <AdminPanelSettings color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Tutorial Approval Panel
            </Typography>
            <Badge badgeContent={pendingCount} color="warning">
              <Chip size="small" label="Pending" color="warning" />
            </Badge>
          </Box>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Review submitted tutorials before publishing to FAQ and onboarding surfaces.
          </Alert>

          <Tabs value={tabValue} onChange={(_, value) => setTabValue(value)} sx={{ mb: 2 }}>
            <Tab label={`Pending (${pendingCount})`} />
            <Tab label={`Approved (${approvedCount})`} />
            <Tab label={`Rejected (${rejectedCount})`} />
          </Tabs>

          {submissionsQuery.isLoading ? (
            <Box sx={{ py: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Loading submissions...
              </Typography>
              <LinearProgress />
            </Box>
          ) : null}

          <Grid container spacing={2}>
            {filteredItems.map((submission) => (
              <Grid item xs={12} md={6} key={submission.id}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5, gap: 1 }}>
                      <Box sx={{ display: 'flex', gap: 1, flex: 1 }}>
                        <Avatar sx={{ bgcolor: submission.type === 'video' ? 'primary.main' : 'secondary.main' }}>
                          <VideoLibrary />
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
                            {submission.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            by {submission.submitterName}
                          </Typography>
                        </Box>
                      </Box>

                      <Chip
                        icon={statusIcon(submission.status)}
                        label={submission.status.toUpperCase()}
                        color={statusChipColor(submission.status)}
                        size="small"
                      />
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      {submission.description}
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5, flexWrap: 'wrap' }}>
                      <Chip size="small" label={`${submission.steps} steps`} variant="outlined" />
                      <Chip size="small" label={`${submission.qualityScore}% quality`} variant="outlined" />
                      <Chip size="small" label={submission.type === 'video' ? 'Video' : 'Mixed'} />
                    </Box>

                    <LinearProgress
                      variant="determinate"
                      value={submission.qualityScore}
                      color={submission.qualityScore >= 80 ? 'success' : submission.qualityScore >= 60 ? 'warning' : 'error'}
                      sx={{ mb: 1.5 }}
                    />

                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      Submitted: {dateString(submission.submittedAt)}
                    </Typography>

                    {submission.adminNotes ? (
                      <Alert severity="success" sx={{ mb: 1 }}>
                        {submission.adminNotes}
                      </Alert>
                    ) : null}

                    {submission.rejectionReason ? (
                      <Alert severity="error" sx={{ mb: 1 }}>
                        {submission.rejectionReason}
                      </Alert>
                    ) : null}

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {submission.status === 'pending' ? (
                        <>
                          <AdminButton
                            size="small"
                            tone="primary"
                            startIcon={<ThumbUp />}
                            onClick={() => openReview(submission, 'approve')}
                          >
                            Approve
                          </AdminButton>
                          <AdminButton
                            size="small"
                            tone="danger"
                            startIcon={<ThumbDown />}
                            onClick={() => openReview(submission, 'reject')}
                          >
                            Reject
                          </AdminButton>
                        </>
                      ) : null}

                      <Tooltip title="Open tutorial URL">
                        <AdminButton
                          size="small"
                          tone="secondary"
                          startIcon={<Visibility />}
                          onClick={() => {
                            if (submission.targetUrl) {
                              window.open(submission.targetUrl, '_blank', 'noopener,noreferrer');
                            }
                          }}
                          disabled={submission.targetUrl.length === 0}
                        >
                          View URL
                        </AdminButton>
                      </Tooltip>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {filteredItems.length === 0 && !submissionsQuery.isLoading ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              No tutorials in this category.
            </Alert>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={reviewDialogOpen} onClose={() => setReviewDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{reviewAction === 'approve' ? 'Approve tutorial' : 'Reject tutorial'}</DialogTitle>
        <DialogContent>
          {selected ? (
            <Box sx={{ pt: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {selected.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                Submitted by {selected.submitterName}
              </Typography>
            </Box>
          ) : null}

          <TextField
            label={reviewAction === 'approve' ? 'Approval notes (optional)' : 'Rejection reason (required)'}
            value={reviewNotes}
            onChange={(event) => setReviewNotes(event.target.value)}
            fullWidth
            multiline
            minRows={4}
          />
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setReviewDialogOpen(false)}>Cancel</AdminButton>
          <AdminButton
            tone={reviewAction === 'approve' ? 'primary' : 'danger'}
            loading={reviewMutation.isPending}
            onClick={submitReview}
            disabled={reviewMutation.isPending || (reviewAction === 'reject' && reviewNotes.trim().length === 0)}
          >
            {reviewAction === 'approve' ? 'Approve' : 'Reject'}
          </AdminButton>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((previous) => ({ ...previous, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((previous) => ({ ...previous, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}

export default TutorialApprovalPanel;
