import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { RateReview as RateReviewIcon, Send as SendIcon } from '@mui/icons-material';
import { useProducerReviews } from '../../hooks/useProducerReviews';
import type { ProducerReviewDecision } from '../../services/producerWorkflowService';

interface ProducerClientReviewPanelProps {
  projectId: string;
  canEdit?: boolean;
  canComment?: boolean;
  canDecide?: boolean;
  quickCreateRequest?: {
    reviewType: string;
    title: string;
    description?: string;
    targetEntityType?: string;
    targetEntityId?: string;
    nonce?: number;
  } | null;
}

const DECISION_OPTIONS: Array<{ value: ProducerReviewDecision; label: string; color: string }> = [
  { value: 'approved', label: 'Godkjenn', color: '#34d399' },
  { value: 'rejected', label: 'Avslå', color: '#f87171' },
  { value: 'changes_requested', label: 'Be om endringer', color: '#fbbf24' },
];

export default function ProducerClientReviewPanel({
  projectId,
  canEdit = true,
  canComment = true,
  canDecide = true,
  quickCreateRequest = null,
}: ProducerClientReviewPanelProps) {
  const { items, summary, loading, error, createReview, addComment, setDecision } = useProducerReviews(projectId);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('shotlist');
  const [newDescription, setNewDescription] = useState('');
  const [newTargetEntityType, setNewTargetEntityType] = useState('');
  const [newTargetEntityId, setNewTargetEntityId] = useState('');
  const [commentDraftByReview, setCommentDraftByReview] = useState<Record<string, string>>({});
  const [commentTimestampByReview, setCommentTimestampByReview] = useState<Record<string, string>>({});
  const [decisionReasonByReview, setDecisionReasonByReview] = useState<Record<string, string>>({});
  const [decisionTimestampByReview, setDecisionTimestampByReview] = useState<Record<string, string>>({});

  const statusColor = useMemo(() => (status: string) => {
    if (status === 'approved') return '#34d399';
    if (status === 'rejected') return '#f87171';
    if (status === 'changes_requested') return '#fbbf24';
    return '#94a3b8';
  }, []);

  const parseTimestampToSeconds = (value?: string): number | undefined => {
    if (!value) return undefined;
    const input = value.trim();
    if (!input) return undefined;

    if (/^\d+$/.test(input)) {
      return Math.max(0, Number.parseInt(input, 10));
    }

    const match = input.match(/^(\d+):([0-5]\d)$/);
    if (!match) return undefined;
    const minutes = Number.parseInt(match[1], 10);
    const seconds = Number.parseInt(match[2], 10);
    return Math.max(0, (minutes * 60) + seconds);
  };

  useEffect(() => {
    if (!quickCreateRequest) return;
    setNewType(quickCreateRequest.reviewType || 'shotlist');
    setNewTitle(quickCreateRequest.title || '');
    setNewDescription(quickCreateRequest.description || '');
    setNewTargetEntityType(quickCreateRequest.targetEntityType || '');
    setNewTargetEntityId(quickCreateRequest.targetEntityId || '');
  }, [quickCreateRequest]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    await createReview({
      reviewType: newType,
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      targetEntityType: newTargetEntityType.trim() || undefined,
      targetEntityId: newTargetEntityId.trim() || undefined,
    });
    setNewTitle('');
    setNewDescription('');
    setNewTargetEntityType('');
    setNewTargetEntityId('');
  };

  const handleComment = async (reviewId: string) => {
    const draft = commentDraftByReview[reviewId]?.trim();
    if (!draft) return;
    await addComment(reviewId, {
      commentText: draft,
      timestampSeconds: parseTimestampToSeconds(commentTimestampByReview[reviewId]),
    });
    setCommentDraftByReview((prev) => ({ ...prev, [reviewId]: '' }));
    setCommentTimestampByReview((prev) => ({ ...prev, [reviewId]: '' }));
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        p: { xs: 1.5, md: 2 },
        borderRadius: 2,
        border: '1px solid rgba(148,163,184,0.22)',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(2,6,23,0.82) 100%)',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap">
        <Stack direction="row" spacing={1} alignItems="center">
          <RateReviewIcon sx={{ color: '#c084fc' }} />
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
            Klientgodkjenning
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Chip size="small" label={`Venter ${summary.pending}`} />
          <Chip size="small" label={`Godkjent ${summary.approved}`} sx={{ color: '#34d399' }} />
          <Chip size="small" label={`Endringer ${summary.changesRequested}`} sx={{ color: '#fbbf24' }} />
        </Stack>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      {canEdit && (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'flex-end' }} flexWrap="wrap">
          <TextField
            size="small"
            label="Review-type"
            value={newType}
            onChange={(event) => setNewType(event.target.value)}
            sx={{ minWidth: 180 }}
            InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
          />
          <TextField
            size="small"
            label="Tittel"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            sx={{ flex: 1, minWidth: 220 }}
            InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
          />
          <TextField
            size="small"
            label="Måltype"
            placeholder="shotlist | manuscript | budget"
            value={newTargetEntityType}
            onChange={(event) => setNewTargetEntityType(event.target.value)}
            sx={{ minWidth: 180 }}
            InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
          />
          <TextField
            size="small"
            label="Mål-ID"
            value={newTargetEntityId}
            onChange={(event) => setNewTargetEntityId(event.target.value)}
            sx={{ minWidth: 180 }}
            InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
          />
          <TextField
            size="small"
            label="Beskrivelse"
            value={newDescription}
            onChange={(event) => setNewDescription(event.target.value)}
            sx={{ flex: 1, minWidth: 260 }}
            InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
          />
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={() => { void handleCreate(); }}
            disabled={loading || !newTitle.trim()}
            sx={{ bgcolor: '#fbbf24', color: '#111827', fontWeight: 700, textTransform: 'none', minWidth: 170 }}
          >
            Send til klient
          </Button>
        </Stack>
      )}

      <Divider sx={{ borderColor: 'rgba(148,163,184,0.2)' }} />

      <Stack spacing={1.2}>
        {items.length === 0 ? (
          <Typography sx={{ color: 'rgba(148,163,184,0.82)' }}>
            Ingen reviews opprettet enda.
          </Typography>
        ) : (
          items.map((review) => (
            <Box
              key={review.id}
              sx={{
                borderRadius: 1.5,
                border: '1px solid rgba(148,163,184,0.22)',
                p: 1.25,
                bgcolor: 'rgba(15,23,42,0.55)',
              }}
            >
              <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center" flexWrap="wrap">
                <Box>
                  <Typography sx={{ color: '#fff', fontWeight: 700 }}>{review.title}</Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.8)', fontSize: '0.85rem' }}>
                    Type: {review.review_type}
                  </Typography>
                  {(review.target_entity_type || review.target_entity_id) && (
                    <Typography sx={{ color: 'rgba(148,163,184,0.9)', fontSize: '0.8rem' }}>
                      Mål: {review.target_entity_type || 'entitet'}
                      {review.target_entity_id ? ` (${review.target_entity_id})` : ''}
                    </Typography>
                  )}
                </Box>
                <Chip
                  size="small"
                  label={review.status}
                  sx={{
                    color: statusColor(review.status),
                    border: `1px solid ${statusColor(review.status)}55`,
                    bgcolor: 'rgba(15,23,42,0.8)',
                  }}
                />
              </Stack>

              <Stack spacing={0.6} sx={{ mt: 1 }}>
                {(review.comments ?? []).map((comment) => (
                  <Box key={comment.id} sx={{ p: 0.8, borderRadius: 1, bgcolor: 'rgba(2,6,23,0.55)' }}>
                    <Typography sx={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{comment.comment_text}</Typography>
                    <Typography sx={{ color: 'rgba(148,163,184,0.8)', fontSize: '0.75rem', mt: 0.2 }}>
                      {comment.author_role || 'ukjent'} • {new Date(comment.created_at).toLocaleString('nb-NO')}
                    </Typography>
                  </Box>
                ))}
              </Stack>

              {canComment && (
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mt: 1 }}>
                  <TextField
                    size="small"
                    placeholder="Skriv kommentar"
                    value={commentDraftByReview[review.id] ?? ''}
                    onChange={(event) => setCommentDraftByReview((prev) => ({ ...prev, [review.id]: event.target.value }))}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    size="small"
                    placeholder="Tid (mm:ss)"
                    value={commentTimestampByReview[review.id] ?? ''}
                    onChange={(event) => setCommentTimestampByReview((prev) => ({ ...prev, [review.id]: event.target.value }))}
                    sx={{ width: { xs: '100%', md: 140 } }}
                  />
                  <Button
                    variant="outlined"
                    onClick={() => { void handleComment(review.id); }}
                    disabled={!commentDraftByReview[review.id]?.trim()}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    Kommenter
                  </Button>
                </Stack>
              )}

              {canDecide && (
                <Stack spacing={1} sx={{ mt: 1 }}>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {DECISION_OPTIONS.map((decisionOption) => (
                      <Button
                        key={decisionOption.value}
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          void setDecision(review.id, {
                            decision: decisionOption.value,
                            reason: decisionReasonByReview[review.id]?.trim() || undefined,
                            timestampSeconds: parseTimestampToSeconds(decisionTimestampByReview[review.id]),
                          });
                          setDecisionReasonByReview((prev) => ({ ...prev, [review.id]: '' }));
                          setDecisionTimestampByReview((prev) => ({ ...prev, [review.id]: '' }));
                        }}
                        sx={{
                          textTransform: 'none',
                          borderColor: `${decisionOption.color}55`,
                          color: decisionOption.color,
                          '&:hover': { borderColor: decisionOption.color, bgcolor: `${decisionOption.color}18` },
                        }}
                      >
                        {decisionOption.label}
                      </Button>
                    ))}
                  </Stack>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                    <TextField
                      size="small"
                      placeholder="Beslutningsnotat (valgfritt)"
                      value={decisionReasonByReview[review.id] ?? ''}
                      onChange={(event) => setDecisionReasonByReview((prev) => ({ ...prev, [review.id]: event.target.value }))}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      size="small"
                      placeholder="Tid (mm:ss)"
                      value={decisionTimestampByReview[review.id] ?? ''}
                      onChange={(event) => setDecisionTimestampByReview((prev) => ({ ...prev, [review.id]: event.target.value }))}
                      sx={{ width: { xs: '100%', md: 140 } }}
                    />
                  </Stack>
                </Stack>
              )}
            </Box>
          ))
        )}
      </Stack>
    </Box>
  );
}
