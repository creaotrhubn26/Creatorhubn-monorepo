/**
 * ResearchDiffSection — renders the diff returned by computeResearchDiff
 * inside the Research Complete overlay. Item #9.
 *
 * Only renders the lists that actually changed; clean re-runs collapse
 * to a single "Identisk med forrige research"-line so the overlay doesn't
 * grow vertically for nothing.
 */

import React from 'react';
import { Box, Chip, Stack, Tooltip, Typography } from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  CompareArrows as CompareArrowsIcon,
} from '@mui/icons-material';
import type { ResearchDiff } from '../../utils/researchDiff';

interface ResearchDiffSectionProps {
  diff: ResearchDiff | null;
}

interface ListRowProps {
  label: string;
  added: string[];
  removed: string[];
}

const ListRow: React.FC<ListRowProps> = ({ label, added, removed }) => {
  if (added.length === 0 && removed.length === 0) return null;
  return (
    <Box>
      <Typography sx={{ color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 700, mb: 0.4 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={0.4} flexWrap="wrap" useFlexGap>
        {added.map((value) => (
          <Chip
            key={`add-${value}`}
            size="small"
            icon={<AddIcon sx={{ fontSize: 12 }} />}
            label={value}
            sx={{
              bgcolor: 'rgba(52,211,153,0.16)',
              color: '#bbf7d0',
              fontSize: '0.74rem',
              '& .MuiChip-icon': { color: '#34d399' },
            }}
          />
        ))}
        {removed.map((value) => (
          <Chip
            key={`rm-${value}`}
            size="small"
            icon={<RemoveIcon sx={{ fontSize: 12 }} />}
            label={value}
            sx={{
              bgcolor: 'rgba(239,68,68,0.14)',
              color: '#fecaca',
              fontSize: '0.74rem',
              textDecoration: 'line-through',
              '& .MuiChip-icon': { color: '#f87171' },
            }}
          />
        ))}
      </Stack>
    </Box>
  );
};

const ResearchDiffSection: React.FC<ResearchDiffSectionProps> = ({ diff }) => {
  if (!diff) return null;
  if (diff.isFirst) return null; // First research has nothing to diff against
  if (diff.isSameResearch) return null; // User reopened same result

  return (
    <Box
      sx={{
        p: 1.4,
        borderRadius: 2,
        border: '1px solid rgba(148,163,184,0.18)',
        bgcolor: 'rgba(15,23,42,0.4)',
        mb: 2,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <CompareArrowsIcon sx={{ color: '#a5b4fc', fontSize: 18 }} />
        <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.92rem' }}>
          Endringer siden forrige research
        </Typography>
        {diff.previousCapturedAt ? (
          <Tooltip title={`Forrige snapshot: ${new Date(diff.previousCapturedAt).toLocaleString('nb-NO')}`}>
            <Chip
              size="small"
              label={new Date(diff.previousCapturedAt).toLocaleDateString('nb-NO')}
              sx={{
                bgcolor: 'rgba(148,163,184,0.12)',
                color: '#cbd5e1',
                fontSize: '0.7rem',
              }}
            />
          </Tooltip>
        ) : null}
      </Stack>

      {!diff.hasAnyChange ? (
        <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.84rem' }}>
          Identisk med forrige research — ingen klassifikasjon, kandidater eller signaler endret seg.
        </Typography>
      ) : (
        <Stack spacing={1.2}>
          {/* Scalar string fields */}
          {diff.industry ? (
            <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '0.82rem' }}>
              <strong style={{ color: '#cbd5e1' }}>Bransje:</strong>{' '}
              <span style={{ color: '#f87171', textDecoration: 'line-through' }}>{diff.industry.from}</span>{' '}
              → <span style={{ color: '#34d399' }}>{diff.industry.to}</span>
            </Typography>
          ) : null}
          {diff.subIndustry ? (
            <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '0.82rem' }}>
              <strong style={{ color: '#cbd5e1' }}>Underbransje:</strong>{' '}
              <span style={{ color: '#f87171', textDecoration: 'line-through' }}>{diff.subIndustry.from}</span>{' '}
              → <span style={{ color: '#34d399' }}>{diff.subIndustry.to}</span>
            </Typography>
          ) : null}
          {diff.businessModel ? (
            <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '0.82rem' }}>
              <strong style={{ color: '#cbd5e1' }}>Forretningsmodell:</strong>{' '}
              <span style={{ color: '#f87171', textDecoration: 'line-through' }}>{diff.businessModel.from}</span>{' '}
              → <span style={{ color: '#34d399' }}>{diff.businessModel.to}</span>
            </Typography>
          ) : null}

          <ListRow label="Målgruppe" added={diff.targetAudience.added} removed={diff.targetAudience.removed} />
          <ListRow label="Tone" added={diff.tone.added} removed={diff.tone.removed} />
          <ListRow label="Konkurrenter" added={diff.competitors.added} removed={diff.competitors.removed} />
          <ListRow label="Sosiale profiler" added={diff.socialProfiles.added} removed={diff.socialProfiles.removed} />
          <ListRow label="Lokale muligheter" added={diff.localOpportunities.added} removed={diff.localOpportunities.removed} />
          <ListRow label="Merch-leverandører" added={diff.merchSuppliers.added} removed={diff.merchSuppliers.removed} />
          <ListRow label="Brand-farger" added={diff.brandColors.added} removed={diff.brandColors.removed} />
        </Stack>
      )}
    </Box>
  );
};

export default ResearchDiffSection;
