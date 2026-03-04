/**
 * ConsentStatusBadge - Visual indicator for candidate consent status
 * 
 * Shows the consent status of a candidate in a compact badge format.
 * Used on candidate cards and lists to quickly identify consent status.
 */

import { useMemo } from 'react';
import {
  Box,
  Chip,
  Tooltip,
  Typography,
  Badge,
  Stack,
} from '@mui/material';
import {
  CheckCircle as SignedIcon,
  Schedule as PendingIcon,
  Error as MissingIcon,
  Send as SentIcon,
  Visibility as ViewedIcon,
  Block as DeclinedIcon,
} from '@mui/icons-material';
import { ConsentsIcon } from './icons/CastingIcons';
import type { Consent } from '../models/casting';

interface ConsentStatusBadgeProps {
  consents: Consent[];
  size?: 'small' | 'medium' | 'large';
  showDetails?: boolean;
  onClick?: () => void;
}

interface ConsentStatusSummary {
  total: number;
  signed: number;
  pending: number;
  sent: number;
  viewed: number;
  declined: number;
  notSent: number;
  status: 'all_signed' | 'some_signed' | 'none_signed' | 'no_consents';
  statusColor: string;
  statusLabel: string;
}

export function ConsentStatusBadge({
  consents,
  size = 'small',
  showDetails = false,
  onClick,
}: ConsentStatusBadgeProps) {
  const summary: ConsentStatusSummary = useMemo(() => {
    if (!consents || consents.length === 0) {
      return {
        total: 0,
        signed: 0,
        pending: 0,
        sent: 0,
        viewed: 0,
        declined: 0,
        notSent: 0,
        status: 'no_consents' as const,
        statusColor: 'rgba(255,255,255,0.3)',
        statusLabel: 'Ingen samtykker',
      };
    }

    const signed = consents.filter(c => c.signed).length;
    const pending = consents.filter(c => !c.signed).length;
    const sent = consents.filter(c => c.invitationStatus === 'sent').length;
    const viewed = consents.filter(c => c.invitationStatus === 'viewed').length;
    const declined = consents.filter(c => c.invitationStatus === 'declined').length;
    const notSent = consents.filter(c => !c.invitationStatus || c.invitationStatus === 'not_sent').length;

    let status: ConsentStatusSummary['status'];
    let statusColor: string;
    let statusLabel: string;

    if (signed === consents.length) {
      status = 'all_signed';
      statusColor = '#10b981';
      statusLabel = 'Alle signert';
    } else if (signed > 0) {
      status = 'some_signed';
      statusColor = '#f59e0b';
      statusLabel = `${signed}/${consents.length} signert`;
    } else {
      status = 'none_signed';
      statusColor = '#ff4444';
      statusLabel = 'Ikke signert';
    }

    return {
      total: consents.length,
      signed,
      pending,
      sent,
      viewed,
      declined,
      notSent,
      status,
      statusColor,
      statusLabel,
    };
  }, [consents]);

  const iconSize = size === 'small' ? 14 : size === 'medium' ? 18 : 22;
  const chipHeight = size === 'small' ? 20 : size === 'medium' ? 24 : 28;
  const fontSize = size === 'small' ? '0.7rem' : size === 'medium' ? '0.8rem' : '0.9rem';

  // Simple badge for no consents
  if (summary.status === 'no_consents') {
    return (
      <Tooltip title="Ingen samtykker registrert">
        <Box
          onClick={onClick}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            cursor: onClick ? 'pointer' : 'default',
            opacity: 0.5,
          }}
        >
          <ConsentsIcon sx={{ fontSize: iconSize, color: 'rgba(255,255,255,0.87)' }} />
          {showDetails && (
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize }}>
              Ingen samtykker
            </Typography>
          )}
        </Box>
      </Tooltip>
    );
  }

  // Compact view - just icon with badge
  if (!showDetails) {
    return (
      <Tooltip 
        title={
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              Samtykker: {summary.statusLabel}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block' }}>
              {summary.signed} av {summary.total} signert
            </Typography>
            {summary.pending > 0 && (
              <Typography variant="caption" sx={{ display: 'block', color: '#f59e0b' }}>
                {summary.pending} venter på signatur
              </Typography>
            )}
          </Box>
        }
      >
        <Badge
          badgeContent={summary.signed}
          max={99}
          sx={{
            cursor: onClick ? 'pointer' : 'default',
            '& .MuiBadge-badge': {
              bgcolor: summary.statusColor,
              color: '#fff',
              fontSize: '0.6rem',
              minWidth: 14,
              height: 14,
            },
          }}
          onClick={onClick}
        >
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: iconSize + 8,
            height: iconSize + 8,
            borderRadius: 1,
            bgcolor: summary.statusColor + '20',
          }}>
            {summary.status === 'all_signed' ? (
              <SignedIcon sx={{ fontSize: iconSize, color: summary.statusColor }} />
            ) : (
              <ConsentsIcon sx={{ fontSize: iconSize, color: summary.statusColor }} />
            )}
          </Box>
        </Badge>
      </Tooltip>
    );
  }

  // Detailed view with chip
  return (
    <Tooltip
      title={
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            Samtykkedetaljer
          </Typography>
          <Stack spacing={0.5}>
            {summary.signed > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SignedIcon sx={{ fontSize: 14, color: '#10b981' }} />
                <Typography variant="caption">{summary.signed} signert</Typography>
              </Box>
            )}
            {summary.viewed > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ViewedIcon sx={{ fontSize: 14, color: '#00d4ff' }} />
                <Typography variant="caption">{summary.viewed} sett</Typography>
              </Box>
            )}
            {summary.sent > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SentIcon sx={{ fontSize: 14, color: '#f59e0b' }} />
                <Typography variant="caption">{summary.sent} sendt</Typography>
              </Box>
            )}
            {summary.declined > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DeclinedIcon sx={{ fontSize: 14, color: '#ff4444' }} />
                <Typography variant="caption">{summary.declined} avslått</Typography>
              </Box>
            )}
            {summary.notSent > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PendingIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.87)' }} />
                <Typography variant="caption">{summary.notSent} ikke sendt</Typography>
              </Box>
            )}
          </Stack>
        </Box>
      }
    >
      <Chip
        icon={
          summary.status === 'all_signed' ? (
            <SignedIcon sx={{ fontSize: iconSize, color: `${summary.statusColor} !important` }} />
          ) : (
            <ConsentsIcon sx={{ fontSize: iconSize, color: `${summary.statusColor} !important` }} />
          )
        }
        label={summary.statusLabel}
        size="small"
        onClick={onClick}
        sx={{
          bgcolor: summary.statusColor + '20',
          color: summary.statusColor,
          fontWeight: 600,
          fontSize,
          height: chipHeight,
          cursor: onClick ? 'pointer' : 'default',
          '& .MuiChip-icon': {
            color: summary.statusColor,
          },
          '&:hover': onClick ? {
            bgcolor: summary.statusColor + '30',
          } : {},
        }}
      />
    </Tooltip>
  );
}

/**
 * ConsentRequiredIndicator - Shows when consent is required but missing
 */
interface ConsentRequiredIndicatorProps {
  required: boolean;
  hasSigned: boolean;
  onClick?: () => void;
}

export function ConsentRequiredIndicator({
  required,
  hasSigned,
  onClick,
}: ConsentRequiredIndicatorProps) {
  if (!required) return null;

  return (
    <Tooltip title={hasSigned ? 'Samtykke signert ✓' : 'Samtykke påkrevd - klikk for å sende'}>
      <Box
        onClick={onClick}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.25,
          borderRadius: 1,
          bgcolor: hasSigned ? '#10b98120' : '#ff444420',
          border: `1px solid ${hasSigned ? '#10b981' : '#ff4444'}40`,
          cursor: onClick ? 'pointer' : 'default',
          transition: 'all 0.2s',
          '&:hover': onClick ? {
            bgcolor: hasSigned ? '#10b98130' : '#ff444430',
            transform: 'scale(1.02)',
          } : {},
        }}
      >
        {hasSigned ? (
          <SignedIcon sx={{ fontSize: 14, color: '#10b981' }} />
        ) : (
          <MissingIcon sx={{ fontSize: 14, color: '#ff4444' }} />
        )}
        <Typography variant="caption" sx={{ 
          color: hasSigned ? '#10b981' : '#ff4444', 
          fontWeight: 600,
          fontSize: '0.65rem',
        }}>
          {hasSigned ? 'Signert' : 'Samtykke kreves'}
        </Typography>
      </Box>
    </Tooltip>
  );
}

export default ConsentStatusBadge;
