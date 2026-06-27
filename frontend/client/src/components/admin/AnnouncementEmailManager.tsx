/**
 * Announcement Email Manager
 * Admin UI for sending announcements as emails
 */

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Alert,
  Divider,
  Chip,
} from '@mui/material';
import {
  Email as EmailIcon,
  Send as SendIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useToast } from '@/hooks/use-toast';
import { AdminButton, adminTokens, useIsMobile } from './design-system';

interface AnnouncementEmailManagerProps {
  announcementId: string;
  announcementTitle: string;
  targetProfessions?: string[];
  emailSent?: boolean;
  emailSentAt?: string;
  emailRecipientCount?: number;
}

export default function AnnouncementEmailManager({
  announcementId,
  announcementTitle,
  targetProfessions = [],
  emailSent = false,
  emailSentAt,
  emailRecipientCount = 0,
}: AnnouncementEmailManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/announcements/${announcementId}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ sendToAll: true }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send emails');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/announcements'] });

      toast({
        title: 'E-poster sendt!',
        description: `Sendt til ${data.results.sent} brukere`,
        variant: 'default',
      });

      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Feil ved sending',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSendEmail = () => {
    sendEmailMutation.mutate();
  };

  return (
    <>
      {/* Send Email Button */}
      <AdminButton
        tone={emailSent ? 'ghost' : 'primary'}
        size="small"
        startIcon={emailSent ? <CheckCircleIcon /> : <EmailIcon />}
        onClick={() => setDialogOpen(true)}
      >
        {emailSent ? 'Sendt til e-post' : 'Send som e-post'}
      </AdminButton>

      {/* Confirmation Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <EmailIcon sx={{ color: adminTokens.color.brand }} />
            <Typography variant="h6">Send kunngjøring som e-post</Typography>
          </Box>
        </DialogTitle>

        <DialogContent>
          {emailSent ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>E-post allerede sendt</strong>
              </Typography>
              <Typography variant="caption" display="block">
                Sendt: {emailSentAt ? new Date(emailSentAt).toLocaleString('nb-NO') : 'Ukjent'}
              </Typography>
              <Typography variant="caption" display="block">
                Mottakere: {emailRecipientCount}
              </Typography>
            </Alert>
          ) : (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Denne kunngjøringen har ikke blitt sendt som e-post ennå.
            </Alert>
          )}

          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Kunngjøring:</strong>
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {announcementTitle}
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Målgruppe:</strong>
            </Typography>
            <Box display="flex" gap={0.5} flexWrap="wrap">
              {targetProfessions.length > 0 ? (
                targetProfessions.map((prof) => (
                  <Chip key={prof} label={prof} size="small" sx={{ bgcolor: '#f0f0f0' }} />
                ))
              ) : (
                <Chip label="Alle brukere" size="small" color="primary" variant="outlined" />
              )}
            </Box>
          </Box>

          {!emailSent && (
            <Alert severity="info">
              <Typography variant="body2">
                E-posten vil bli sendt til alle aktive brukere i målgruppen.
              </Typography>
            </Alert>
          )}
        </DialogContent>

        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setDialogOpen(false)} disabled={sendEmailMutation.isPending}>
            Avbryt
          </AdminButton>
          <AdminButton
            tone="primary"
            onClick={handleSendEmail}
            loading={sendEmailMutation.isPending}
            startIcon={<SendIcon />}
            disabled={sendEmailMutation.isPending}
          >
            {sendEmailMutation.isPending ? 'Sender...' : 'Send e-post'}
          </AdminButton>
        </DialogActions>
      </Dialog>
    </>
  );
}
