/**
 * Email Activity Indicator
 * Viser e-postaktivitet for kontrakter og prosjekter
 */

import { useTheming } from '../utils/theming-helper';
import React from 'react';
import {
  Box,
  Chip,
  Tooltip,
  Typography,
  Badge,
  CircularProgress
} from '@mui/material';
import {
  Email as EmailIcon,
  MarkEmailRead as EmailOpenIcon,
  MarkEmailUnread as EmailUnreadIcon,
  Send as SendIcon,
  Error as ErrorIcon,
  CheckCircle as DeliveredIcon,
  Visibility as ViewIcon,
  Link as LinkIcon
} from '@mui/icons-material';

interface EmailActivityIndicatorProps {
  emailActivity?: {
    totalEmails: number;
    deliveryStats: {
      sent: number;
      delivered: number;
      failed: number;
      opened: number;
      clicked: number;
};
    recentActivity: Array<{
      trackingId: string;
      subject: string;
      emailType: string;
      sentAt: string;
      deliveryStatus: string;
      opened: boolean;
      openedAt?: string;
      clicks: number;
      status: string;
}>;
};
  projectId: string;
  contractId?: string;
  compact?: boolean
}

export default function EmailActivityIndicator({ 
  emailActivity, 
  projectId, 
  contractId, 
  compact = false 
}: EmailActivityIndicatorProps) {
  
  if (!emailActivity) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, opacity: 0.6}}>
        <EmailIcon fontSize="small" />
        <Typography variant="caption" color="text.secondary">
          Ingen e-postaktivitet
        </Typography>
      </Box>
    );
}

  const { deliveryStats, recentActivity } = emailActivity;
  const latestEmail = recentActivity[0];

  // Calculate delivery rate
  const deliveryRate = deliveryStats.sent > 0 
    ? Math.round((deliveryStats.delivered / deliveryStats.sent) * 100) 
    : 0;

  // Calculate open rate
  const openRate = deliveryStats.delivered > 0 
    ? Math.round((deliveryStats.opened / deliveryStats.delivered) * 100) 
    : 0;

  const getStatusIcon = (status: string, opened: boolean, deliveryStatus: string) => {
    if (deliveryStatus === 'failed') {
      return <ErrorIcon fontSize="small" color="error" />;
}
    if (deliveryStatus === 'sending') {
      return <CircularProgress size={16} />;
  }
    if (opened) {
      return <EmailOpenIcon fontSize="small" color="success" />;
  }
    if (deliveryStatus === 'delivered') {
      return <EmailUnreadIcon fontSize="small" color="warning" />;
  }
    return <SendIcon fontSize="small" color="primary" />;
};

  const getStatusText = (status: string, opened: boolean, deliveryStatus: string) => {
    if (deliveryStatus === 'failed') return 'Feilet';
    if (deliveryStatus === 'sending') return 'Sender...';
    if (opened) return 'Åpnet';
    if (deliveryStatus === 'delivered') return 'Levert, ikke åpnet';
    return 'Sendt';
};

  const getStatusColor = (status: string, opened: boolean, deliveryStatus: string) => {
    if (deliveryStatus === 'failed') return 'error';
    if (deliveryStatus === 'sending') return 'info';
    if (opened) return 'success';
    if (deliveryStatus === 'delivered') return 'warning';
    return 'primary';
};

  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
        <Tooltip title={`${deliveryStats.sent} e-post sendt, ${deliveryStats.opened} åpnet`}>
          <Badge badgeContent={deliveryStats.opened} color="success">
            <EmailIcon fontSize="small" color={deliveryStats.opened > 0 ? 'success' : 'action'} />
          </Badge>
        </Tooltip>
        
        {latestEmail && (
          <Tooltip title={`Siste: ${latestEmail.subject} - ${getStatusText(latestEmail.status, latestEmail.opened, latestEmail.deliveryStatus)}`}>
            <Chip
              icon={getStatusIcon(latestEmail.status, latestEmail.opened, latestEmail.deliveryStatus)}
              label={getStatusText(latestEmail.status, latestEmail.opened, latestEmail.deliveryStatus)}
              size="small"
              color={getStatusColor(latestEmail.status, latestEmail.opened, latestEmail.deliveryStatus) as any}
              variant="outlined"
              sx={{ fontSize: '0.75rem', height: 24}}
            />
          </Tooltip>
        )}
      </Box>
    );
}

  return (
    <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 2, bgcolor: '#fafafa'}}>
      <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
        <EmailIcon />
        E-postaktivitet
      </Typography>

      {/* Stats overview */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap'}}>
        <Tooltip title="Totalt antall e-post sendt">
          <Chip
            icon={<SendIcon />}
            label={`${deliveryStats.sent} sendt`}
            color="primary"
            variant="outlined"
            size="small"
          />
        </Tooltip>

        <Tooltip title="Andel levert til mottaker">
          <Chip
            icon={<DeliveredIcon />}
            label={`${deliveryRate}% levert`}
            color={deliveryRate > 90 ? 'success' : 'warning'}
            variant="outlined"
            size="small"
          />
        </Tooltip>

        <Tooltip title="Andel åpnet av mottaker">
          <Chip
            icon={<ViewIcon />}
            label={`${openRate}% åpnet`}
            color={openRate > 50 ? 'success' : openRate > 20 ? 'warning' : 'error'}
            variant="outlined"
            size="small"
          />
        </Tooltip>

        {deliveryStats.clicked > 0 && (
          <Tooltip title="Antall klikk på lenker">
            <Chip
              icon={<LinkIcon />}
              label={`${deliveryStats.clicked} klikk`}
              color="info"
              variant="outlined"
              size="small"
            />
          </Tooltip>
        )}
      </Box>

      {/* Recent activity */}
      <Typography variant="subtitle2" gutterBottom>
        Nylig aktivitet: </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1 }}>
        {recentActivity.slice(0, 3).map((email) => (
          <Box
            key={email.trackingId}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p:  1,
              bgcolor: 'white',
              borderRadius:  1,
              border: '1px solid #f0f0f0'
        }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex:  1 }}>
              {getStatusIcon(email.status, email.opened, email.deliveryStatus)}
              <Box sx={{ flex: 1, minWidth:  0 }}>
                <Typography variant="body2" sx={{ fontWeight: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                  {email.subject}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {email.emailType === 'contract_update' ? 'Kontraktoppdatering' : 
                   email.emailType === 'contract_original' ? 'Opprinnelig kontrakt' :
                   email.emailType === 'gallery_ready' ? 'Galleri klart' : 'E-post'}
                  {' • '}
                  {new Date(email.sentAt).toLocaleDateString('nb-NO', { 
                    day: 'numeric', 
                    month: 'short', 
                    hour: '2-digit', 
                    minute: '2-digit' 
              })}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
              <Chip
                label={getStatusText(email.status, email.opened, email.deliveryStatus)}
                size="small"
                color={getStatusColor(email.status, email.opened, email.deliveryStatus) as any}
                variant={email.opened ? 'filled' : 'outlined'}
                sx={{ fontSize: '0.75rem', minWidth: 80}}
              />
              
              {email.clicks > 0 && (
                <Tooltip title={`${email.clicks} klikk`}>
                  <Badge badgeContent={email.clicks} color="info" sx={{ ml:  1 }}>
                    <LinkIcon fontSize="small" />
                  </Badge>
                </Tooltip>
              )}
            </Box>
          </Box>
        ))}
      </Box>

      {recentActivity.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic'}}>
          Ingen e-postaktivitet registrert enda
        </Typography>
      )}
    </Box>
  );
}