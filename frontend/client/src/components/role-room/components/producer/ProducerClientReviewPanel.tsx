import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { RateReview as RateReviewIcon, Send as SendIcon } from '@mui/icons-material';
import { useProducerReviews } from '../../hooks/useProducerReviews';
import type { ProducerReviewDecision } from '../../services/producerWorkflowService';
import {
  formatProducerTimestamp,
  getProducerEntityTypeLabel,
  getProducerReviewStatusLabel,
  getProducerReviewTypeLabel,
  PRODUCER_REVIEW_TYPE_OPTIONS,
  type ProducerWorkflowEntityOption,
} from '../../utils/producerWorkflow';

interface ProducerClientReviewPanelProps {
  projectId: string;
  canEdit?: boolean;
  canComment?: boolean;
  canDecide?: boolean;
  canApproveReview?: boolean;
  canRequestReviewChanges?: boolean;
  entityOptions?: ProducerWorkflowEntityOption[];
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

const EMPTY_ENTITY_OPTIONS: ProducerWorkflowEntityOption[] = [];

function getDefaultTargetEntityType(reviewType: string): string {
  return PRODUCER_REVIEW_TYPE_OPTIONS.find((option) => option.value === reviewType)?.defaultTargetEntityType ?? '';
}

export default function ProducerClientReviewPanel({
  projectId,
  canEdit = true,
  canComment = true,
  canDecide = true,
  canApproveReview = false,
  canRequestReviewChanges = false,
  entityOptions = EMPTY_ENTITY_OPTIONS,
  quickCreateRequest = null,
}: ProducerClientReviewPanelProps) {
  const { items, summary, loading, error, createReview, addComment, setDecision } = useProducerReviews(projectId);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('shotlist');
  const [newDescription, setNewDescription] = useState('');
  const [newDueAt, setNewDueAt] = useState('');
  const [newTargetEntityType, setNewTargetEntityType] = useState('');
  const [newTargetEntityId, setNewTargetEntityId] = useState('');
  const [commentDraftByReview, setCommentDraftByReview] = useState<Record<string, string>>({});
  const [commentTimestampByReview, setCommentTimestampByReview] = useState<Record<string, string>>({});
  const [decisionReasonByReview, setDecisionReasonByReview] = useState<Record<string, string>>({});
  const [decisionTimestampByReview, setDecisionTimestampByReview] = useState<Record<string, string>>({});

  const distinctEntityTypes = useMemo(() => {
    const seen = new Set<string>();
    return entityOptions.filter((option) => {
      if (!option.entityType || seen.has(option.entityType)) {
        return false;
      }
      seen.add(option.entityType);
      return true;
    });
  }, [entityOptions]);

  const filteredEntityOptions = useMemo(() => {
    if (!newTargetEntityType) {
      return entityOptions;
    }
    return entityOptions.filter((option) => option.entityType === newTargetEntityType);
  }, [entityOptions, newTargetEntityType]);

  const decisionOptions = useMemo(() => {
    return DECISION_OPTIONS.filter((option) => {
      if (option.value === 'changes_requested') {
        return canRequestReviewChanges;
      }
      return canApproveReview;
    });
  }, [canApproveReview, canRequestReviewChanges]);

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

  const handleReviewTypeChange = (nextType: string) => {
    const nextTargetEntityType = getDefaultTargetEntityType(nextType);
    setNewType(nextType);
    setNewTargetEntityType(nextTargetEntityType);

    const nextTargetEntityId = entityOptions.find((option) => option.entityType === nextTargetEntityType)?.entityId ?? '';
    setNewTargetEntityId(nextTargetEntityId);
  };

  useEffect(() => {
    if (!quickCreateRequest) return;
    const nextType = quickCreateRequest.reviewType || 'shotlist';
    const nextTargetEntityType = quickCreateRequest.targetEntityType || getDefaultTargetEntityType(nextType);
    const nextTargetEntityId = quickCreateRequest.targetEntityId
      || entityOptions.find((option) => option.entityType === nextTargetEntityType)?.entityId
      || '';

    setNewType(nextType);
    setNewTitle(quickCreateRequest.title || '');
    setNewDescription(quickCreateRequest.description || '');
    setNewTargetEntityType(nextTargetEntityType);
    setNewTargetEntityId(nextTargetEntityId);
  }, [entityOptions, quickCreateRequest]);

  useEffect(() => {
    if (newTargetEntityId && filteredEntityOptions.some((option) => option.entityId === newTargetEntityId)) {
      return;
    }
    setNewTargetEntityId(filteredEntityOptions[0]?.entityId ?? '');
  }, [filteredEntityOptions, newTargetEntityId]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    await createReview({
      reviewType: newType,
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      dueAt: newDueAt || undefined,
      targetEntityType: newTargetEntityType || undefined,
      targetEntityId: newTargetEntityId || undefined,
    });
    setNewTitle('');
    setNewDescription('');
    setNewDueAt('');
    setNewTargetEntityType(getDefaultTargetEntityType('shotlist'));
    setNewTargetEntityId('');
    setNewType('shotlist');
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

  const getEntityLabel = (entityType?: string | null, entityId?: string | null): string | null => {
    if (!entityType && !entityId) {
      return null;
    }
    const matchingEntity = entityOptions.find((option) => option.entityType === entityType && option.entityId === entityId);
    if (matchingEntity) {
      return matchingEntity.description ? `${matchingEntity.label} · ${matchingEntity.description}` : matchingEntity.label;
    }
    if (entityType) {
      const label = getProducerEntityTypeLabel(entityType);
      return entityId ? `${label} (${entityId})` : label;
    }
    return entityId ?? null;
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
        <Stack spacing={1.2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'flex-end' }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel sx={{ color: 'rgba(226,232,240,0.82)' }}>Reviewtype</InputLabel>
              <Select
                label="Reviewtype"
                value={newType}
                onChange={(event) => handleReviewTypeChange(String(event.target.value))}
                sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' } }}
              >
                {PRODUCER_REVIEW_TYPE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
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
              label="Frist"
              type="datetime-local"
              value={newDueAt}
              onChange={(event) => setNewDueAt(event.target.value)}
              sx={{ minWidth: 220 }}
              InputLabelProps={{ shrink: true, sx: { color: 'rgba(226,232,240,0.82)' } }}
            />
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'flex-end' }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel sx={{ color: 'rgba(226,232,240,0.82)' }}>Måltype</InputLabel>
              <Select
                label="Måltype"
                value={newTargetEntityType}
                onChange={(event) => {
                  const nextType = String(event.target.value);
                  setNewTargetEntityType(nextType);
                  setNewTargetEntityId(entityOptions.find((option) => option.entityType === nextType)?.entityId ?? '');
                }}
                sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' } }}
              >
                <MenuItem value="">Ingen kobling</MenuItem>
                {distinctEntityTypes.map((option) => (
                  <MenuItem key={option.entityType} value={option.entityType}>
                    {getProducerEntityTypeLabel(option.entityType)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {filteredEntityOptions.length > 0 ? (
              <FormControl size="small" sx={{ flex: 1, minWidth: 260 }}>
                <InputLabel sx={{ color: 'rgba(226,232,240,0.82)' }}>Målentitet</InputLabel>
                <Select
                  label="Målentitet"
                  value={newTargetEntityId}
                  onChange={(event) => setNewTargetEntityId(String(event.target.value))}
                  sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' } }}
                >
                  {filteredEntityOptions.map((option) => (
                    <MenuItem key={`${option.entityType}:${option.entityId}`} value={option.entityId}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <TextField
                size="small"
                label="Mål-ID"
                value={newTargetEntityId}
                onChange={(event) => setNewTargetEntityId(event.target.value)}
                sx={{ flex: 1, minWidth: 220 }}
                InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
              />
            )}
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

          <TextField
            size="small"
            label="Beskrivelse"
            value={newDescription}
            onChange={(event) => setNewDescription(event.target.value)}
            multiline
            minRows={2}
            InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
          />
        </Stack>
      )}

      <Divider sx={{ borderColor: 'rgba(148,163,184,0.2)' }} />

      <Stack spacing={1.2}>
        {items.length === 0 ? (
          <Typography sx={{ color: 'rgba(148,163,184,0.82)' }}>
            Ingen reviews opprettet enda.
          </Typography>
        ) : (
          items.map((review) => {
            const entityLabel = getEntityLabel(review.target_entity_type, review.target_entity_id);
            return (
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
                      Type: {getProducerReviewTypeLabel(review.review_type)}
                    </Typography>
                    {entityLabel && (
                      <Typography sx={{ color: 'rgba(148,163,184,0.9)', fontSize: '0.8rem' }}>
                        Mål: {entityLabel}
                      </Typography>
                    )}
                    {review.due_at && (
                      <Typography sx={{ color: 'rgba(148,163,184,0.9)', fontSize: '0.8rem' }}>
                        Frist: {new Date(review.due_at).toLocaleString('nb-NO')}
                      </Typography>
                    )}
                  </Box>
                  <Chip
                    size="small"
                    label={getProducerReviewStatusLabel(review.status)}
                    sx={{
                      color: review.status === 'approved' ? '#34d399' : review.status === 'changes_requested' ? '#fbbf24' : review.status === 'rejected' ? '#f87171' : '#94a3b8',
                      border: '1px solid rgba(148,163,184,0.35)',
                      bgcolor: 'rgba(15,23,42,0.8)',
                    }}
                  />
                </Stack>

                {review.description && (
                  <Typography sx={{ color: 'rgba(203,213,225,0.9)', fontSize: '0.9rem', mt: 1 }}>
                    {review.description}
                  </Typography>
                )}

                <Stack spacing={0.6} sx={{ mt: 1 }}>
                  {(review.comments ?? []).map((comment) => (
                    <Box key={comment.id} sx={{ p: 0.8, borderRadius: 1, bgcolor: 'rgba(2,6,23,0.55)' }}>
                      <Typography sx={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{comment.comment_text}</Typography>
                      <Typography sx={{ color: 'rgba(148,163,184,0.8)', fontSize: '0.75rem', mt: 0.2 }}>
                        {comment.author_role || 'ukjent'} • {new Date(comment.created_at).toLocaleString('nb-NO')}
                        {typeof comment.timestamp_seconds === 'number' ? ` • ${formatProducerTimestamp(comment.timestamp_seconds)}` : ''}
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

                {canDecide && decisionOptions.length > 0 && (
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {decisionOptions.map((decisionOption) => (
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
            );
          })
        )}
      </Stack>
    </Box>
  );
}
