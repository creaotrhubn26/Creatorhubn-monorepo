// @ts-nocheck
/**
 * AiTransparencyBanner — shown above every Role Room Agent response to
 * satisfy GDPR Art. 13.2f (automated decision-making / meaningful info
 * about the logic involved) and Art. 22 transparency expectations.
 *
 * It does NOT explain the model weights; it explains:
 *   - which fields were sent (from describePiiExposure)
 *   - which model processed them
 *   - how long responses are retained
 *   - a link to revoke consent
 */

import React from 'react';
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { InfoOutlined as InfoIcon } from '@mui/icons-material';

interface AiTransparencyBannerProps {
  model: string;
  fields: string[];
  entityCount?: number;
  retentionLabel?: string;
  onRevokeConsent?: () => void;
  onOpenDetails?: () => void;
}

export const AiTransparencyBanner: React.FC<AiTransparencyBannerProps> = ({
  model,
  fields,
  entityCount,
  retentionLabel = 'Lagret i 12 måneder i auditlogg; ikke brukt til modelltrening.',
  onRevokeConsent,
  onOpenDetails,
}) => {
  return (
    <Alert
      severity="info"
      icon={<InfoIcon fontSize="small" />}
      variant="outlined"
      sx={{ mb: 1, alignItems: 'flex-start' }}
    >
      <Stack spacing={0.75}>
        <Typography variant="body2" fontWeight={700}>
          AI-assistert svar fra {model}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {retentionLabel}
        </Typography>
        {fields.length > 0 || entityCount ? (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Felt som ble sendt (pseudonymisert der relevant):
            </Typography>
            <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
              {fields.map((field) => (
                <Chip key={field} size="small" label={field} variant="outlined" />
              ))}
              {entityCount ? (
                <Chip size="small" label={`${entityCount} pseudonymer`} variant="outlined" color="primary" />
              ) : null}
            </Stack>
          </Box>
        ) : null}
        <Stack direction="row" spacing={1}>
          {onOpenDetails ? (
            <Button size="small" onClick={onOpenDetails}>
              Se prompt-logg
            </Button>
          ) : null}
          {onRevokeConsent ? (
            <Button size="small" color="error" onClick={onRevokeConsent}>
              Trekk tilbake AI-samtykke
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Alert>
  );
};

export default AiTransparencyBanner;
