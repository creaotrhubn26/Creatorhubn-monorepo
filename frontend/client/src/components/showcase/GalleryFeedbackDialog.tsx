// @ts-nocheck
/**
 * GalleryFeedbackDialog — Slice 9X.84
 *
 * Admin-wrapper rundt EditFeedbackSummary. Henter klient-tilbakemelding
 * (video_timecode_comments) for galleriet og lar Bjarne markere som
 * løst direkte fra oversikten. Brukes fra ClientGalleriesManager via
 * "Tilbakemelding"-knappen på galleri-kort som har video/audio.
 */
import React from 'react';
import {
  Dialog,
  DialogContent,
  IconButton,
  Box,
  CircularProgress,
  Typography,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import EditFeedbackSummary, { FeedbackEntry } from '../gallery/EditFeedbackSummary';

interface VideoComment {
  id: string;
  chapterId: string | null;
  timecodeSec: number;
  endTimecodeSec: number | null;
  category: string | null;
  priority: string | null;
  comment: string;
  clientName: string | null;
  clientEmail: string | null;
  status: 'open' | 'resolved' | 'archived';
  resolvedAt: string | null;
  createdAt: string;
  suggestedMediaUrl: string | null;
  suggestedMediaLabel: string | null;
  suggestedMediaFromSec: number | null;
  suggestedMediaToSec: number | null;
  parentId: string | null;
  authorKind: 'client' | 'photographer';
}

interface Props {
  open: boolean;
  galleryId: string;
  projectTitle?: string | null;
  clientName?: string | null;
  onClose: () => void;
}

const GalleryFeedbackDialog: React.FC<Props> = ({
  open,
  galleryId,
  projectTitle,
  clientName,
  onClose,
}) => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ comments: VideoComment[] }>({
    queryKey: ['/api/photographer/galleries', galleryId, 'video-comments'],
    queryFn: () =>
      apiRequest(`/api/photographer/galleries/${galleryId}/video-comments`),
    enabled: open && Boolean(galleryId),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ commentId, status }: { commentId: string; status: 'open' | 'resolved' }) => {
      return apiRequest(
        `/api/photographer/galleries/${galleryId}/video-comments/${commentId}`,
        { method: 'PATCH', body: JSON.stringify({ status }) },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/photographer/galleries', galleryId, 'video-comments'],
      });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ parentId, comment }: { parentId: string; comment: string }) => {
      return apiRequest(
        `/api/photographer/galleries/${galleryId}/video-comments/${parentId}/reply`,
        { method: 'POST', body: JSON.stringify({ comment }) },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/photographer/galleries', galleryId, 'video-comments'],
      });
    },
  });

  const entries: FeedbackEntry[] = (data?.comments || []).map((c) => ({
    id: c.id,
    timecodeSec: c.timecodeSec,
    endTimecodeSec: c.endTimecodeSec,
    comment: c.comment,
    category: (c.category as FeedbackEntry['category']) || 'other',
    priority: (c.priority as FeedbackEntry['priority']) || 'suggestion',
    clientName: c.clientName,
    clientEmail: c.clientEmail,
    status: c.status,
    createdAt: c.createdAt,
    suggestedMediaUrl: c.suggestedMediaUrl,
    suggestedMediaLabel: c.suggestedMediaLabel,
    suggestedMediaFromSec: c.suggestedMediaFromSec,
    suggestedMediaToSec: c.suggestedMediaToSec,
    parentId: c.parentId,
    authorKind: c.authorKind,
  }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#fdfaf5',
          borderRadius: 0,
        },
      }}
    >
      <Box sx={{ position: 'relative' }}>
        <IconButton
          onClick={onClose}
          aria-label="Lukk tilbakemelding"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 2,
            color: '#5a4f42',
            bgcolor: 'rgba(253, 250, 245, 0.9)',
            '&:hover': { color: '#1a1612', bgcolor: '#fdfaf5' },
          }}
        >
          <CloseIcon />
        </IconButton>

        <DialogContent sx={{ p: 0 }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress sx={{ color: '#d97706' }} />
            </Box>
          ) : entries.length === 0 ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Typography
                sx={{
                  fontFamily: '"Cormorant Garamond", Georgia, serif',
                  fontSize: '1.4rem',
                  fontStyle: 'italic',
                  color: '#5a4f42',
                }}
              >
                Ingen tilbakemelding ennå
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Klienten har ikke sendt kommentarer på dette galleriet ennå.
              </Typography>
            </Box>
          ) : (
            <EditFeedbackSummary
              entries={entries}
              clientName={clientName}
              projectTitle={projectTitle}
              onToggleResolved={(commentId, status) =>
                toggleMutation.mutate({ commentId, status })
              }
              onReply={(parentId, comment) =>
                replyMutation.mutateAsync({ parentId, comment })
              }
            />
          )}
        </DialogContent>
      </Box>
    </Dialog>
  );
};

export default GalleryFeedbackDialog;
