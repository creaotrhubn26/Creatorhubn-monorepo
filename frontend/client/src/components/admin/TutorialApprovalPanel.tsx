/**
 * Tutorial Approval Panel - Admin panel for å godkjenne/avslå tutorial submissions
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Grid,
  Avatar,
  Badge,
  Tabs,
  Tab,
  Rating,
  LinearProgress,
  Stack,
  IconButton,
  Tooltip,
  Snackbar,
} from '@mui/material';
import {
  AdminPanelSettings as AdminIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Schedule as PendingIcon,
  Star as QualityIcon,
  VideoLibrary as VideoIcon,
  PhotoLibrary as PhotoIcon,
  Person as UserIcon,
  Visibility as ViewIcon,
  Edit as ReviewIcon,
  ThumbUp as LikeIcon,
  ThumbDown as DislikeIcon,
  Quiz as FAQIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

interface TutorialSubmission {
  id: string;
  title: string;
  description: string;
  targetUrl: string;
  type: 'video' | 'mixed';
  steps: number;
  qualityScore: number;
  submittedBy: string;
  submitterName: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNotes?: string;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  duplicateOf?: string;
}

interface TutorialApprovalPanelProps {
  open: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

export const TutorialApprovalPanel: React.FC<TutorialApprovalPanelProps> = ({
  open,
  onClose,
  isAdmin = true
}) => {
  const [submissions, setSubmissions] = useState<TutorialSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<TutorialSubmission | null>(null);
  const [reviewDialog, setReviewDialog] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  // Mock data for demonstration
  useEffect(() => {
    
    
    setSubmissions(mockSubmissions);
}, []);

  const handleReview = (submission: TutorialSubmission, action: 'approve' | 'reject') => {
    setSelectedSubmission(submission);
    setReviewAction(action);
    setReviewNotes(', ');
    setReviewDialog(true);
};

  const confirmReview = async () => {
    if (!selectedSubmission || !reviewAction) return;

    try {
      // Simulate API call
      const updatedSubmission: TutorialSubmission = {
        ...selectedSubmission,
        status: reviewAction,
        reviewedBy: 'admin_001', // Current admin ID
        reviewedAt: new Date().toISOString(),
        ...(reviewAction === 'reject' ? { rejectionReason: reviewNotes } : {}),
        ...(reviewAction === 'approve' ? { adminNotes: reviewNotes } : {})
    };

      // Update submissions list
      setSubmissions(prev => 
        prev.map(sub => sub.id === selectedSubmission.id ? updatedSubmission : sub)
      );

      // Show success message
      const actionText = reviewAction === 'approve' ? 'godkjent' : 'avslått';
      const message = reviewAction === 'approve' 
        ? `✅ Tutorial "${selectedSubmission.title}" er godkjent! Tutorial vil nå vises i FAQ-systemet.`
        : `✅ Tutorial "${selectedSubmission.title}" er avslått. Bruker vil få melding om avslag.`;
      setSnackbar({ open: true, message, severity: 'success' });

      setReviewDialog(false);
      setSelectedSubmission(null);
      setReviewAction(null);

  } catch (error) {
      console.error('Review failed: ', error);
      setSnackbar({ open: true, message: '❌ Feil ved vurdering. Prøv igjen.', severity: 'error' });
  }
};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'approved': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
}
};

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <PendingIcon />;
      case 'approved': return <ApproveIcon />;
      case 'rejected': return <RejectIcon />;
      default: return <PendingIcon />;
}
};

  const filteredSubmissions = submissions.filter(sub => {
    switch (tabValue) {
      case 0: return sub.status === 'pending';
      case 1: return sub.status === 'approved';
      case 2: return sub.status === 'rejected';
      default: return true;
}
});

  const pendingCount = submissions.filter(s => s.status === 'pending').length;
  const approvedCount = submissions.filter(s => s.status === 'approved').length;
  const rejectedCount = submissions.filter(s => s.status === 'rejected').length;

  if (!isAdmin) {
    return (
      <Dialog open={open} onClose={onClose}>
        <DialogContent>
          <Alert severity="error">
            🚫 Kun administratorer har tilgang til tutorial-godkjenningspanelet.
          </Alert>
        </DialogContent>
      </Dialog>
    );
}

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <AdminIcon color="primary" />
            <Typography variant="h5" sx={{ color: theming.colors.primary }}>Tutorial Godkjenningspanel</Typography>
            <Badge badgeContent={pendingCount} color="warning">
              <Chip label="Avventer Vurdering" color="warning" />
            </Badge>
          </Box>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          <Alert severity="info" sx={{ mb:  3 }}>
            🛠️ <strong>Admin Panel: </strong> Vurder og godkjenn de beste tutorials for FAQ-systemet. 
            Godkjente tutorials publiseres og brukere får CreatorHub Verified poeng.
          </Alert>

          {/* Status Tabs , *, /}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb:  3 }}>
            <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
              <Tab 
                label={
                  <Badge badgeContent={pendingCount} color="warning">
                    <Box sx={{ px:  1 }}>Avventer ({pendingCount})</Box>
                  </Badge>
              }
              />
              <Tab 
                label={
                  <Badge badgeContent={approvedCount} color="success">
                    <Box sx={{ px:  1 }}>Godkjent ({approvedCount})</Box>
                  </Badge>
              }
              />
              <Tab 
                label={
                  <Badge badgeContent={rejectedCount} color="error">
                    <Box sx={{ px:  1 }}>Avslått ({rejectedCount})</Box>
                  </Badge>
              }
              />
            </Tabs>
          </Box>

          {/* Submissions Grid */}
          <Grid container spacing={2}>
            {filteredSubmissions.map((submission) => (
              <Grid size={{ xs: 12 }} md={6} key={submission.id}>
                <Card sx={{ height: '100%', position: 'relative',  ...theming.getThemedCardSx() }}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    {/* Status Badge */}
                    <Chip
                      icon={getStatusIcon(submission.status)}
                      label={submission.status.toUpperCase()}
                      color={getStatusColor(submission.status)}
                      size="small"
                      sx={{ position: 'absolute', top:  8, right:  8 }}
                    />

                    {/* Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, pr: 8 }}>
                      <Avatar sx={{ bgcolor: submission.type === 'video' ? 'primary.main' : 'secondary.main'}}>
                        {submission.type === 'video' ? <VideoIcon /> : <PhotoIcon />}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth:  0 }}>
                        <Typography variant="h6" noWrap sx={{ color: theming.colors.primary }}>
                          {submission.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          av {submission.submitterName}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Description */}
                    <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary'}}>
                      {submission.description}
                    </Typography>

                    {/* Metrics */}
                    <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap'}}>
                      <Chip 
                        label={`${submission.qualityScore}% kvalitet`}
                        color={submission.qualityScore >= 80 ? 'success' : submission.qualityScore >= 60 ? 'warning' : 'default'}
                        size="small"
                      />
                      <Chip 
                        label={`${submission.steps} steg`}
                        size="small" 
                      />
                      <Chip 
                        label={submission.type === 'video' ? '🎥 Video' : '📸 Mixed'}
                        size="small"
                        color={submission.type === 'video' ? 'primary' : 'secondary'}
                      />
                    </Box>

                    {/* Quality Score Visual */}
                    <Box sx={{ mb:  2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Kvalitetsscore
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={submission.qualityScore}
                        sx={{ height:  6, borderRadius:  3 }}
                        color={submission.qualityScore >= 80 ? 'success' : submission.qualityScore >= 60 ? 'warning' : 'error'}
                      />
                    </Box>

                    {/* Submission Info */}
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb:  2 }}>
                      📅 Sendt inn: {new Date(submission.submittedAt).toLocaleDateString('no-N', {
                        day: '2-digit',
                        month: '2-digit', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                  })}
                    </Typography>

                    {/* Admin Notes/Rejection Reason */}
                    {submission.adminNotes && (
                      <Alert severity="info" sx={{ mb: 2, fontSize: '0.875rem'}}>
                        <strong>Admin notater: </strong> {submission.adminNotes}
                      </Alert>
                    )}
                    {submission.rejectionReason && (
                      <Alert severity="error" sx={{ mb: 2, fontSize: '0.875rem'}}>
                        <strong>Avslag: </strong> {submission.rejectionReason}
                      </Alert>
                    )}

                    {/* Action Buttons */}
                    <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                      {submission.status === 'pending' && (
                        <>
                          <Button variant="contained"
                            color="success"
                            size="small"
                            startIcon={<ApproveIcon />}
                            onClick={() => handleReview(submission, 'approve')}
                          >
                            Godkjenn
                          </Button>
                          <Button variant="contained"
                            color="error"
                            size="small"
                            startIcon={<RejectIcon />}
                            onClick={() => handleReview(submission, 'reject')}
                          >
                            Avslå
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ViewIcon />}
                        onClick={() => window.open(submission.targetUrl', '_blank')}
                      >
                        Se URL
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {filteredSubmissions.length === 0 && (
            <Alert severity="info" sx={{ textAlign: 'center'}}>
              📭 Ingen tutorials i denne kategorien enda.
            </Alert>
          )}
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={reviewDialog} onClose={() => setReviewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {reviewAction === 'approve' ? '✅ Godkjenn Tutorial' : '❌ Avslå Tutorial'}
        </DialogTitle>
        <DialogContent>
          {selectedSubmission && (
            <Box>
              <Typography variant="subtitle1" sx={{ mb:  2 }}>
                <strong>"{selectedSubmission.title}"</strong> av {selectedSubmission.submitterName}
              </Typography>
              
              <TextField
                fullWidth
                multiline
                rows={4}
                label={reviewAction === 'approve' ? 'Godkjenningsnotater (valgfritt)' : 'Avslagsbegrunnelse (påkrevd)'}
                placeholder={reviewAction === 'approve' ? 
                  'Legg til notater om hvorfor denne tutorial er godkjent...' :
                  'Forklar hvorfor denne tutorial avslås (brukeren vil se dette)...'
              }
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                required={reviewAction === 'reject'}
              />

              {reviewAction === 'approve' && (
                <Alert severity="success" sx={{ mt:  2 }}>
                  ✅ Tutorial vil publiseres i FAQ-systemet og bruker får CreatorHub Verified poeng!
                </Alert>
              )}
              {reviewAction === 'reject' && (
                <Alert severity="warning" sx={{ mt:  2 }}>
                  ⚠️ Bruker vil få melding om avslag med din begrunnelse. Vær konstruktiv!
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewDialog(false)}>
            Avbryt
          </Button>
          <Button variant="contained"
            color={reviewAction === 'approve' ? 'success' : 'error'}
            onClick={confirmReview}
            disabled={reviewAction === 'reject' && !reviewNotes.trim()}
           sx={theming.getThemedButtonSx()}>
            {reviewAction === 'approve' ? 'Godkjenn Tutorial' : 'Avslå Tutorial'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar Notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};