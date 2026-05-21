/**
 * EmptyState — gjenbrukbar tom-tilstand-komponent for RoleRoom-paneler.
 *
 * Bruksområde: HVER tabell, liste eller dashboard som kan være tom
 * skal vise EmptyState istedenfor en blank skjerm eller "0 rader"-melding.
 * Bruker som ikke har lagt til data ennå skal alltid forstå:
 *   1. Hva skal være her?
 *   2. Hvorfor er det tomt?
 *   3. Hva er neste handling?
 *
 * Bygget bevisst minimal — én primary CTA er nok. Hvis du trenger flere
 * actions, vurder om panelet faktisk er "tomt" eller om det er en annen
 * type tilstand (loading, error, etc.).
 *
 * Eksempel:
 *   <EmptyState
 *     icon={<SchoolIcon />}
 *     title="Du har ikke registrert klasser ennå"
 *     description="Klasser brukes til timeplan, påmelding og fakturering."
 *     primaryAction={{ label: 'Opprett første klasse', onClick: handleNew }}
 *     hint="Tips: dra og slipp en CSV med eksisterende klasser fra Stripe/Excel."
 *   />
 */

import React from 'react';
import { Box, Stack, Typography, Button, Paper } from '@mui/material';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  primaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
    icon?: React.ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  /** Lite hjelpe-hint nederst (typisk pro-tips eller link til docs) */
  hint?: React.ReactNode;
  /** Bruker "card"-styling med Paper-bakgrunn, default true */
  card?: boolean;
  /** Mindre versjon for sidepanel eller inline */
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  hint,
  card = true,
  compact = false,
}) => {
  const content = (
    <Stack
      spacing={compact ? 1 : 2}
      alignItems="center"
      sx={{ textAlign: 'center', py: compact ? 3 : 6, px: 2 }}
    >
      {icon && (
        <Box
          sx={{
            width: compact ? 48 : 72,
            height: compact ? 48 : 72,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(245, 184, 46, 0.10)',
            color: '#F5B82E',
            '& > svg': { fontSize: compact ? 28 : 40 },
          }}
        >
          {icon}
        </Box>
      )}
      <Typography
        variant={compact ? 'subtitle1' : 'h6'}
        sx={{ fontWeight: 700, maxWidth: 420 }}
      >
        {title}
      </Typography>
      {description && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ maxWidth: 480, lineHeight: 1.6 }}
        >
          {description}
        </Typography>
      )}
      {(primaryAction || secondaryAction) && (
        <Stack direction="row" spacing={1.2} sx={{ mt: 1.5 }}>
          {primaryAction && (
            <Button
              variant="contained"
              size={compact ? 'small' : 'medium'}
              startIcon={primaryAction.icon}
              onClick={primaryAction.onClick}
              href={primaryAction.href}
              sx={{
                bgcolor: '#F5B82E',
                color: '#1F2937',
                fontWeight: 700,
                '&:hover': { bgcolor: '#D49B1A' },
              }}
            >
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="outlined"
              size={compact ? 'small' : 'medium'}
              onClick={secondaryAction.onClick}
              href={secondaryAction.href}
            >
              {secondaryAction.label}
            </Button>
          )}
        </Stack>
      )}
      {hint && (
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ mt: 2, maxWidth: 480, fontStyle: 'italic' }}
        >
          {hint}
        </Typography>
      )}
    </Stack>
  );

  if (!card) return content;

  return (
    <Paper
      variant="outlined"
      sx={{
        bgcolor: 'rgba(255, 255, 255, 0.02)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderStyle: 'dashed',
        borderRadius: 2,
      }}
    >
      {content}
    </Paper>
  );
};

export default EmptyState;
