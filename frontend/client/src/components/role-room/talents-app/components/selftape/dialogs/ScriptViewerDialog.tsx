/**
 * ScriptViewerDialog — vis hele manus + scene-info i fullskjerm-modal.
 *
 * Brukes både fra "Se brief"-knappen og "Se hele manus"-lenken.
 */
import {
  Box, Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import { palette, radius } from '../../../theme';
import type { SelftapeProject } from '../../../../services/roleRoomSelfTapesService';

interface Props {
  open: boolean;
  project: SelftapeProject | null;
  onClose: () => void;
  variant?: 'brief' | 'script';
}

interface ScriptLine {
  character: string;
  dialog: string;
}

function parseScript(md: string | null): ScriptLine[] {
  if (!md) return [];
  const lines: ScriptLine[] = [];
  const blocks = md.split(/\n\s*\n/);
  for (const block of blocks) {
    const match = block.match(/^\*\*([^*]+)\*\*\s*\n([\s\S]+)$/);
    if (match) lines.push({ character: match[1].trim(), dialog: match[2].trim() });
  }
  return lines;
}

export default function ScriptViewerDialog({
  open, project, onClose, variant = 'script',
}: Props) {
  if (!project) return null;
  const lines = parseScript(project.sides_content);
  const title = variant === 'brief'
    ? `Brief — ${project.name}`
    : `Manus — ${project.scene_label ?? project.name}`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          bgcolor: palette.bgShell,
          color: palette.textPrimary,
          border: `1px solid ${palette.border}`,
          borderRadius: radius.lg,
        },
      }}
    >
      <DialogTitle sx={{ pr: 6 }}>
        <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>{title}</Typography>
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 12, top: 12, color: palette.textMuted }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {/* Brief-fakta */}
        <Stack direction="row" spacing={3} sx={{ mb: 3, flexWrap: 'wrap', gap: 1.4 }}>
          <Fact label="Rolle" value={project.role_name ?? '—'} />
          <Fact label="Rolletype" value={project.role_type ?? '—'} />
          <Fact label="Scene" value={project.scene_label ?? '—'} />
          <Fact label="Sider" value={project.sides_pages ? `${project.sides_pages} sider` : '—'} />
        </Stack>

        {project.brief_url ? (
          <Box
            component="a"
            href={project.brief_url}
            target="_blank"
            rel="noreferrer"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.6,
              mb: 2,
              color: palette.accentBright,
              fontSize: '0.86rem',
              fontWeight: 600,
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            <OpenInNewIcon sx={{ fontSize: 14 }} />
            Åpne brief-PDF
          </Box>
        ) : null}

        {/* Manus */}
        {lines.length === 0 ? (
          <Typography sx={{ color: palette.textMuted, fontSize: '0.9rem', fontStyle: 'italic' }}>
            Ingen manus lastet inn for denne scenen.
          </Typography>
        ) : (
          <Stack spacing={2}>
            {lines.map((line, idx) => (
              <Box key={idx}>
                <Typography
                  sx={{
                    color: palette.textMuted,
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    letterSpacing: 0.1,
                    textTransform: 'uppercase',
                    mb: 0.4,
                  }}
                >
                  {line.character}
                </Typography>
                <Typography sx={{ color: palette.textPrimary, fontSize: '0.96rem', lineHeight: 1.55 }}>
                  {line.dialog}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography sx={{ color: palette.textMuted, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </Typography>
      <Typography sx={{ color: palette.textPrimary, fontWeight: 600, fontSize: '0.92rem' }}>
        {value}
      </Typography>
    </Box>
  );
}
