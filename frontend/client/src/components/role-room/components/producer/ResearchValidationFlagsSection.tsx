/**
 * ResearchValidationFlagsSection — renders the quality-assurance flags
 * (items #51-#75) from the bootstrap result. Grouped by severity with
 * critical/warning sections expanded by default and info collapsed
 * (info is mostly suggestions; user can drill down if interested).
 *
 * Each flag with a fixTargetId gets a "Fix"-button that scrolls to the
 * relevant field in the same way ResearchNextStepsCards does.
 */

import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Error as CriticalIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  Shield as ShieldIcon,
} from '@mui/icons-material';
import type { RoleRoomAgentProducerBootstrapResult } from '../../services/roleRoomAgentService';

type Flag = NonNullable<RoleRoomAgentProducerBootstrapResult['validationFlags']>[number];

const SEVERITY_META: Record<Flag['severity'], { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  critical: { label: 'Kritisk', color: '#f87171', bg: 'rgba(239,68,68,0.12)', Icon: CriticalIcon },
  warning: { label: 'Advarsel', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', Icon: WarningIcon },
  info: { label: 'Info', color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', Icon: InfoIcon },
};

const CATEGORY_LABEL: Record<string, string> = {
  consistency: 'Konsistens',
  completeness: 'Komplett-sjekk',
  data_quality: 'Datakvalitet',
  trust_signal: 'Tillitssignaler',
  seo: 'SEO',
  performance: 'Ytelse',
  content: 'Innhold',
  external_state: 'Ekstern status',
  suggestion: 'Forslag',
  change_detection: 'Endringer',
};

interface ResearchValidationFlagsSectionProps {
  flags: Flag[] | undefined;
}

const ResearchValidationFlagsSection: React.FC<ResearchValidationFlagsSectionProps> = ({ flags }) => {
  const grouped = useMemo(() => {
    const out: Record<Flag['severity'], Flag[]> = { critical: [], warning: [], info: [] };
    for (const f of flags ?? []) {
      out[f.severity].push(f);
    }
    return out;
  }, [flags]);

  // Info collapsed by default — keeps the overlay compact for clean
  // research runs where the only flags are suggestions.
  const [infoExpanded, setInfoExpanded] = useState(false);

  const total = (flags ?? []).length;
  if (total === 0) {
    // Don't take vertical space when everything is clean — the overlay
    // already shows "Klar for marketing plan ✓" in the summary card.
    return null;
  }

  const handleFix = (targetId?: string): void => {
    if (!targetId) return;
    requestAnimationFrame(() => {
      const target = document.getElementById(targetId) as HTMLElement | null;
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof (target as HTMLInputElement).focus === 'function') {
        (target as HTMLInputElement).focus({ preventScroll: true });
      }
    });
  };

  const renderFlag = (flag: Flag): React.ReactElement => {
    const meta = SEVERITY_META[flag.severity];
    const Icon = meta.Icon;
    return (
      <Box
        key={flag.id}
        sx={{
          p: 0.9,
          borderRadius: 1.6,
          border: `1px solid ${meta.color}33`,
          bgcolor: meta.bg,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 0.8,
        }}
      >
        <Icon sx={{ color: meta.color, fontSize: 18, mt: 0.2, flexShrink: 0 }} />
        <Stack spacing={0.3} sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={0.6} flexWrap="wrap" useFlexGap>
            <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.84rem' }}>
              {flag.title}
            </Typography>
            <Chip
              size="small"
              label={CATEGORY_LABEL[flag.category] ?? flag.category}
              sx={{
                bgcolor: 'rgba(148,163,184,0.14)',
                color: 'rgba(226,232,240,0.7)',
                height: 16,
                fontSize: '0.66rem',
              }}
            />
          </Stack>
          <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.78rem', lineHeight: 1.45 }}>
            {flag.detail}
          </Typography>
          {flag.fixHint ? (
            <Typography sx={{ color: 'rgba(226,232,240,0.45)', fontSize: '0.7rem', fontStyle: 'italic' }}>
              {flag.fixHint}
            </Typography>
          ) : null}
        </Stack>
        {flag.fixTargetId ? (
          <Tooltip title="Gå til feltet">
            <IconButton
              size="small"
              onClick={() => handleFix(flag.fixTargetId)}
              sx={{ color: meta.color, mt: -0.2 }}
              aria-label="Fix"
            >
              <EditIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>
    );
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <ShieldIcon sx={{ color: grouped.critical.length > 0 ? '#f87171' : grouped.warning.length > 0 ? '#fbbf24' : '#60a5fa', fontSize: 18 }} />
        <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>
          Kvalitets-flagg
        </Typography>
        <Chip
          size="small"
          label={`${total} totalt`}
          sx={{
            bgcolor: 'rgba(148,163,184,0.14)',
            color: 'rgba(226,232,240,0.7)',
            height: 18,
            fontSize: '0.7rem',
          }}
        />
        {grouped.critical.length > 0 ? (
          <Chip size="small" label={`${grouped.critical.length} kritisk`} sx={{ bgcolor: SEVERITY_META.critical.bg, color: SEVERITY_META.critical.color, height: 18 }} />
        ) : null}
        {grouped.warning.length > 0 ? (
          <Chip size="small" label={`${grouped.warning.length} advarsel`} sx={{ bgcolor: SEVERITY_META.warning.bg, color: SEVERITY_META.warning.color, height: 18 }} />
        ) : null}
      </Stack>

      <Stack spacing={0.6}>
        {grouped.critical.map(renderFlag)}
        {grouped.warning.map(renderFlag)}
        {grouped.info.length > 0 ? (
          <>
            <Button
              size="small"
              onClick={() => setInfoExpanded((prev) => !prev)}
              startIcon={
                <ExpandMoreIcon
                  sx={{
                    transform: infoExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                    fontSize: 16,
                  }}
                />
              }
              sx={{
                textTransform: 'none',
                color: '#60a5fa',
                fontSize: '0.78rem',
                alignSelf: 'flex-start',
                px: 0.6,
              }}
            >
              {infoExpanded ? 'Skjul' : 'Vis'} {grouped.info.length} info-flagg
            </Button>
            <Collapse in={infoExpanded} unmountOnExit>
              <Stack spacing={0.6}>{grouped.info.map(renderFlag)}</Stack>
            </Collapse>
          </>
        ) : null}
      </Stack>
    </Box>
  );
};

export default ResearchValidationFlagsSection;
