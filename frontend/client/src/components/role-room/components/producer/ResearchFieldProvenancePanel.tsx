/**
 * ResearchFieldProvenancePanel — covers items #5 (AI vs user-input
 * heatmap), #6 (confidence badge per field), #7 (source attribution),
 * #16 (confidence inheritance chain), #17 ("Why this conclusion?"
 * modal).
 *
 * Renders a compact grid of fields, each with a source-colored dot
 * (heatmap), confidence badge, and click-to-explain rationale modal.
 */

import React, { useMemo, useState } from 'react';
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  HelpOutline as HelpOutlineIcon,
  Close as CloseIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import {
  buildResearchProvenance,
  getSourceColor,
  getSourceLabel,
  type FieldProvenance,
  type ProvenanceSource,
} from '../../utils/researchProvenance';
import type { RoleRoomAgentProducerBootstrapResult } from '../../services/roleRoomAgentService';

interface ResearchFieldProvenancePanelProps {
  result: RoleRoomAgentProducerBootstrapResult;
}

const ResearchFieldProvenancePanel: React.FC<ResearchFieldProvenancePanelProps> = ({ result }) => {
  const provenance = useMemo(() => buildResearchProvenance(result), [result]);
  const [openField, setOpenField] = useState<FieldProvenance | null>(null);

  // #5 — heatmap legend: distinct sources used in this run
  const sourcesUsed = useMemo(() => {
    const set = new Set<ProvenanceSource>();
    provenance.forEach((p) => set.add(p.source));
    return Array.from(set);
  }, [provenance]);

  if (provenance.length === 0) return null;

  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>
          Felt-opprinnelse
        </Typography>
        <Tooltip title="Hvert felt fargekodes etter hvilken kilde som mest sannsynlig produserte verdien. Klikk for å se hvorfor.">
          <HelpOutlineIcon sx={{ color: 'rgba(226,232,240,0.5)', fontSize: 14 }} />
        </Tooltip>
      </Stack>

      {/* #5 Heatmap legend */}
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 1.2 }}>
        {sourcesUsed.map((source) => (
          <Chip
            key={source}
            size="small"
            label={getSourceLabel(source)}
            sx={{
              bgcolor: `${getSourceColor(source)}24`,
              color: getSourceColor(source),
              fontSize: '0.7rem',
              border: `1px solid ${getSourceColor(source)}44`,
              height: 20,
            }}
          />
        ))}
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          gap: 0.8,
        }}
      >
        {provenance.map((p) => {
          const color = getSourceColor(p.source);
          return (
            <Tooltip
              key={p.field}
              title={`${getSourceLabel(p.source)} · ${p.confidence}% konfidens. Klikk for hvorfor.`}
              placement="top"
              arrow
            >
              <Box
                onClick={() => setOpenField(p)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setOpenField(p);
                }}
                sx={{
                  cursor: 'pointer',
                  p: 0.8,
                  borderRadius: 1.5,
                  border: '1px solid rgba(148,163,184,0.16)',
                  bgcolor: 'rgba(15,23,42,0.4)',
                  transition: 'border-color 0.15s, background-color 0.15s',
                  '&:hover': { borderColor: color, bgcolor: 'rgba(15,23,42,0.6)' },
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.8,
                  position: 'relative',
                }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: color,
                    flexShrink: 0,
                  }}
                />
                <Stack spacing={0} sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    sx={{
                      color: '#cbd5e1',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                    }}
                  >
                    {p.label}
                  </Typography>
                  <Typography
                    sx={{
                      color: 'rgba(226,232,240,0.5)',
                      fontSize: '0.68rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={String(p.value ?? '—')}
                  >
                    {p.value === null || p.value === '' ? '—' : String(p.value)}
                  </Typography>
                </Stack>
                <Chip
                  size="small"
                  label={`${p.confidence}`}
                  sx={{
                    bgcolor: `${color}24`,
                    color,
                    fontSize: '0.66rem',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    height: 18,
                  }}
                />
              </Box>
            </Tooltip>
          );
        })}
      </Box>

      {/* #17 "Why this conclusion?" modal */}
      <Dialog
        open={openField !== null}
        onClose={() => setOpenField(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#0b1226',
            color: '#f8fafc',
            border: '1px solid rgba(148,163,184,0.18)',
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack spacing={0.2}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
                Hvorfor denne {openField?.label?.toLowerCase()}?
              </Typography>
              <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.78rem' }}>
                Klikk-for-å-forstå: ingen Claude-rationale ennå, men kjeden er sporbar.
              </Typography>
            </Stack>
            <IconButton onClick={() => setOpenField(null)} sx={{ color: '#cbd5e1' }} size="small">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {openField ? (
            <Stack spacing={1.6}>
              {/* Field value */}
              <Box
                sx={{
                  p: 1.2,
                  borderRadius: 2,
                  bgcolor: 'rgba(15,23,42,0.5)',
                  border: '1px solid rgba(148,163,184,0.16)',
                }}
              >
                <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.74rem', mb: 0.3 }}>
                  Verdi
                </Typography>
                <Typography sx={{ color: '#f8fafc', fontWeight: 600 }}>
                  {openField.value === null || openField.value === '' ? '—' : String(openField.value)}
                </Typography>
              </Box>

              {/* #6 Confidence */}
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontSize: '0.82rem' }}>
                  Konfidens:
                </Typography>
                <Chip
                  size="small"
                  label={`${openField.confidence}/100`}
                  sx={{
                    bgcolor: `${getSourceColor(openField.source)}24`,
                    color: getSourceColor(openField.source),
                    fontWeight: 700,
                    fontFamily: 'monospace',
                  }}
                />
                <Box sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: 'rgba(148,163,184,0.18)', overflow: 'hidden' }}>
                  <Box
                    sx={{
                      width: `${openField.confidence}%`,
                      height: '100%',
                      bgcolor: getSourceColor(openField.source),
                    }}
                  />
                </Box>
              </Stack>

              {/* #16 Inheritance chain */}
              <Box>
                <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.74rem', mb: 0.6 }}>
                  Kilde-kjede
                </Typography>
                <Stack direction="row" spacing={0.4} alignItems="center" flexWrap="wrap" useFlexGap>
                  {openField.chain.map((src, idx) => (
                    <React.Fragment key={`${src}-${idx}`}>
                      <Chip
                        size="small"
                        label={getSourceLabel(src)}
                        sx={{
                          bgcolor: `${getSourceColor(src)}24`,
                          color: getSourceColor(src),
                          fontWeight: 600,
                          border: `1px solid ${getSourceColor(src)}44`,
                        }}
                      />
                      {idx < openField.chain.length - 1 ? (
                        <ChevronRightIcon sx={{ color: 'rgba(226,232,240,0.4)', fontSize: 14 }} />
                      ) : null}
                    </React.Fragment>
                  ))}
                </Stack>
                {openField.chain.length > 1 ? (
                  <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.72rem', mt: 0.6 }}>
                    Konfidensen arves fra siste lenke i kjeden. Tidligere stadier ga bare inn-data.
                  </Typography>
                ) : null}
              </Box>

              {/* #17 Rationale */}
              <Box
                sx={{
                  p: 1.2,
                  borderRadius: 2,
                  bgcolor: 'rgba(99,102,241,0.08)',
                  border: '1px solid rgba(99,102,241,0.24)',
                }}
              >
                <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.74rem', mb: 0.3 }}>
                  Hvorfor
                </Typography>
                <Typography sx={{ color: '#e0e7ff', fontSize: '0.86rem', lineHeight: 1.5 }}>
                  {openField.rationale}
                </Typography>
              </Box>
            </Stack>
          ) : null}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default ResearchFieldProvenancePanel;
