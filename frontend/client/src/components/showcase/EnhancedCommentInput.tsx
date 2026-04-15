// @ts-nocheck
import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Paper,
  Typography,
  Stack,
  Chip,
  Switch,
  FormControlLabel,
  Avatar,
  Collapse,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  alpha,
} from '@mui/material';
import {
  Send,
  CheckCircle,
  Edit,
  Comment as CommentIcon,
  HelpOutline,
  ExpandMore,
  Article,
  Link as LinkIcon,
  Info,
  Lightbulb,
  Star,
  Clear,
} from '@mui/icons-material';

interface EnhancedCommentInputProps {
  newComment: string;
  setNewComment: (comment: string) => void;
  onSubmit: () => void;
  selectedItem?: any;
  user?: any;
  project?: any;
  contract?: any;
  customBranding?: { color: string };
}

export const EnhancedCommentInput: React.FC<EnhancedCommentInputProps> = ({
  newComment,
  setNewComment,
  onSubmit,
  selectedItem,
  user,
  project,
  contract,
  customBranding = { color: '#FF6B35' },
}) => {
  const [selectedCommentType, setSelectedCommentType] = useState<
    'approval' | 'revision' | 'feedback'
  >('feedback');
  const [commentPreview, setCommentPreview] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [showContractDialog, setShowContractDialog] = useState(false);
  const [linkedContractItem, setLinkedContractItem] = useState<string | null>(null);

  const commentTypes = [
    { type: 'approval' as const, label: 'Approval', icon: <CheckCircle />, color: 'success' },
    { type: 'revision' as const, label: 'Revision', icon: <Edit />, color: 'warning' },
    { type: 'feedback' as const, label: 'Feedback', icon: <CommentIcon />, color: 'primary' },
  ];

  const guidelines = {
    approval: ['✅ Confirm what you love','❤️ Be specific','🎯 Reference contract'],
    revision: ['🔍 Be specific','📍 Reference location','📊 Check contract'],
    feedback: ['💭 Share thoughts','⭐ Mention what works','🎨 Comment on style'],
  };

  const templates = {
    approval: ['Perfect! We love it ❤️','Exactly what we wanted 🎉','Beautiful! ✨'],
    revision: ['Can you brighten this?','Different angle?','Color adjustment needed'],
    feedback: ['Wonderful work!','Great composition','Love the mood'],
  };

  const norwegianTemplates = ['Dette er nydelig! 🇳🇴', 'Perfekt! ✨', 'Vi elsker dette ❤️'];

  const deliverables = contract?.metadata?.deliverables || [
    { id: '1', name: 'Ceremony Coverage (2 hours)', status: 'in_progress' },
    { id: '2', name: '50 Edited Photos', status: 'pending' },
    { id: '3', name: 'Online Gallery', status: 'completed' },
  ];

  return (
    <Paper
      elevation={3}
      sx={{ p: 3, borderRadius: 2, border: `2px solid ${alpha(customBranding.color, 0.2)}` }}

    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CommentIcon sx={{ color: customBranding.color }} />
          Add Feedback
        </Typography>
        <Box>
          <Tooltip title="Guidelines">
            <IconButton size="small" onClick={() => setShowGuidelines(!showGuidelines)}>
              <HelpOutline />
            </IconButton>
          </Tooltip>
          {contract && (
            <Tooltip title="Contract">
              <IconButton size="small" onClick={() => setShowContractDialog(true)}>
                <Article />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      <Collapse in={showGuidelines}>
        <Alert severity="info" icon={<Lightbulb />} sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight="bold">
            💡 Tips: </Typography>
          {(guidelines[selectedCommentType] || []).map((g, i) => (
            <Typography key={i} variant="body2">
              {g}
            </Typography>
          ))}
        </Alert>
      </Collapse>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        {commentTypes.map((t) => (
          <Chip
            key={t.type}
            icon={t.icon}
            label={t.label}
            color={selectedCommentType === t.type ? (t.color as any) : 'default'}
            onClick={() => setSelectedCommentType(t.type)}
            variant={selectedCommentType === t.type ? 'filled' : 'outlined'}
          />
        ))}
      </Stack>

      <TextField
        fullWidth
        multiline
        rows={4}
        placeholder="Share your feedback..."
        value={newComment}
        onChange={(e) => setNewComment(e.target.value)}
        sx={{ mb: 2 }} />

      <Accordion elevation={0} sx={{ mb: 2, bgcolor: 'grey.50' }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="body2">
            <Star fontSize="small" /> Templates
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ mb: 1 }}>
            {(templates[selectedCommentType] || []).map((t) => (
              <Chip
                key={t}
                label={t}
                size="small"
                onClick={() => setNewComment(t)}
                sx={{ mr: 0.5, mb: 0.5 }} />
            ))}
          </Box>
          <Typography variant="caption">Norsk 🇳🇴:</Typography>
          <Box>
            {norwegianTemplates.map((t) => (
              <Chip
                key={t}
                label={t}
                size="small"
                onClick={() => setNewComment(t)}
                sx={{ mr: 0.5 }} />
            ))}
          </Box>
        </AccordionDetails>
      </Accordion>

      {linkedContractItem && (
        <Alert
          severity="info"
          icon={<LinkIcon />}
          onClose={() => setLinkedContractItem(null)}
          sx={{ mb: 2 }}>
          Linked: {deliverables.find((d) => d.id === linkedContractItem)?.name}
        </Alert>
      )}

      <FormControlLabel
        control={
          <Switch checked={commentPreview} onChange={(e) => setCommentPreview(e.target.checked)} />
        }
        label="Preview"
        sx={{ mb: 2 }} />

      {commentPreview && newComment && (
        <Paper elevation={2} sx={{ p: 2, mb: 2, bgcolor: 'grey.100' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: customBranding.color }}>
              {(user?.firstName || 'Y').charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="caption" fontWeight="bold">
                {user?.firstName || 'You'}
              </Typography>
              <Chip label={selectedCommentType} size="small" sx={{ ml: 1 }} />
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {newComment}
              </Typography>
            </Box>
          </Box>
        </Paper>
      )}

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
        <Button onClick={() => setNewComment('')} startIcon={<Clear />}>
          Clear
        </Button>
        <Button
          variant="contained"
          onClick={onSubmit}
          disabled={!newComment.trim()}
          startIcon={<Send />}
          sx={{ bgcolor: customBranding.color }}>
          Send
        </Button>
      </Box>

      <Dialog
        open={showContractDialog}
        onClose={() => setShowContractDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Article sx={{ color: customBranding.color }} />
            Contract
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Reference contract when commenting.
          </Alert>
          <Typography variant="subtitle1" fontWeight="bold">
            {contract?.title || 'Wedding Package'}
          </Typography>
          <Divider sx={{ my: 2 }} />
          <List>
            {deliverables.map((d) => (
              <ListItem
                key={d.id}
                secondaryAction={
                  <Button
                    size="small"
                    onClick={() => {
                      setLinkedContractItem(d.id);
                      setShowContractDialog(false);
                    }}
                  >
                    Link
                  </Button>
                }
              >
                <ListItemIcon>
                  {d.status ==='completed' ? (
                    <CheckCircle color="success" />
                  ) : (
                    <Info color="primary" />
                  )}
                </ListItemIcon>
                <ListItemText primary={d.name} secondary={`Status: ${d.status}`} />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowContractDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default EnhancedCommentInput;
