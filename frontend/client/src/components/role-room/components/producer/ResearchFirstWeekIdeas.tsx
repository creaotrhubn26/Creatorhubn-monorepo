/**
 * ResearchFirstWeekIdeas — item #44.
 *
 * Renders the 3 generated content suggestions as cards. Each shows the
 * hook, format-tag, and rationale. "Send til feed-planner"-knapp er en
 * placeholder — actual integration with feedPlanner.ts would need a
 * shared draft-store; for this batch the button copies the hook to
 * clipboard so the user can paste it manually. Lavest-friction path.
 */

import React from 'react';
import { Box, Button, Chip, Stack, Tooltip, Typography } from '@mui/material';
import {
  Lightbulb as LightbulbIcon,
  ContentCopy as CopyIcon,
  Movie as ReelIcon,
  ViewCarousel as CarouselIcon,
  Image as ImageIcon,
  AutoStories as StoryIcon,
} from '@mui/icons-material';
import { generateFirstWeekIdeas, type FirstWeekIdea } from '../../utils/researchFirstWeekIdeas';
import type { RoleRoomAgentProducerBootstrapResult } from '../../services/roleRoomAgentService';

const FORMAT_META: Record<FirstWeekIdea['format'], { label: string; color: string; Icon: React.ComponentType<{ fontSize?: 'small' | 'medium' | 'large' | 'inherit' }> }> = {
  reel: { label: 'Reel', color: '#f472b6', Icon: ReelIcon },
  carousel: { label: 'Carousel', color: '#a78bfa', Icon: CarouselIcon },
  image: { label: 'Bilde', color: '#22d3ee', Icon: ImageIcon },
  story: { label: 'Story', color: '#fbbf24', Icon: StoryIcon },
};

interface ResearchFirstWeekIdeasProps {
  result: RoleRoomAgentProducerBootstrapResult;
}

const ResearchFirstWeekIdeas: React.FC<ResearchFirstWeekIdeasProps> = ({ result }) => {
  const ideas = React.useMemo(() => generateFirstWeekIdeas(result), [result]);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  if (ideas.length === 0) return null;

  const handleCopy = async (idea: FirstWeekIdea): Promise<void> => {
    try {
      await navigator.clipboard.writeText(`${idea.hook}\n\n${idea.body}`);
      setCopiedId(idea.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // clipboard blocked — fall back silently
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <LightbulbIcon sx={{ color: '#fbbf24', fontSize: 18 }} />
        <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>
          Forslag til første uken
        </Typography>
        <Chip
          size="small"
          label="3 ideer"
          sx={{ bgcolor: 'rgba(251,191,36,0.16)', color: '#fde68a', fontWeight: 600, height: 18 }}
        />
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: 1,
        }}
      >
        {ideas.map((idea, idx) => {
          const meta = FORMAT_META[idea.format];
          const Icon = meta.Icon;
          const copied = copiedId === idea.id;
          return (
            <Box
              key={idea.id}
              sx={{
                p: 1.2,
                borderRadius: 2,
                border: `1px solid ${meta.color}33`,
                bgcolor: 'rgba(15,23,42,0.4)',
                display: 'flex',
                flexDirection: 'column',
                gap: 0.6,
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" alignItems="center" spacing={0.6}>
                  <Box
                    sx={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      bgcolor: meta.color,
                      color: '#0b1226',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                    }}
                  >
                    {idx + 1}
                  </Box>
                  <Chip
                    size="small"
                    icon={<Icon fontSize="inherit" />}
                    label={meta.label}
                    sx={{
                      bgcolor: `${meta.color}1f`,
                      color: meta.color,
                      fontWeight: 600,
                      height: 20,
                      '& .MuiChip-icon': { color: meta.color, fontSize: 12 },
                    }}
                  />
                </Stack>
              </Stack>
              <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.86rem', lineHeight: 1.35 }}>
                {idea.hook}
              </Typography>
              <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.74rem', lineHeight: 1.45 }}>
                {idea.body}
              </Typography>
              <Tooltip title={idea.rationale} placement="top" arrow>
                <Typography
                  sx={{
                    color: 'rgba(226,232,240,0.4)',
                    fontSize: '0.7rem',
                    fontStyle: 'italic',
                    cursor: 'help',
                    borderTop: '1px dashed rgba(148,163,184,0.18)',
                    pt: 0.4,
                  }}
                >
                  Hvorfor →
                </Typography>
              </Tooltip>
              <Button
                size="small"
                startIcon={<CopyIcon sx={{ fontSize: 12 }} />}
                onClick={() => void handleCopy(idea)}
                sx={{
                  alignSelf: 'flex-start',
                  textTransform: 'none',
                  color: copied ? '#34d399' : meta.color,
                  fontSize: '0.72rem',
                  py: 0,
                  px: 0.6,
                  minWidth: 0,
                }}
              >
                {copied ? 'Kopiert ✓' : 'Kopier til feed-planner'}
              </Button>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default ResearchFirstWeekIdeas;
