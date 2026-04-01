/**
 * CommunityHighlightsSidebar Component
 * 
 * Sidebar showing community highlights and benefits
 */

import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Divider,
  Stack,
  Box,
} from '@mui/material';
import {
  Forum,
  Lightbulb,
  EmojiEvents,
  Group,
} from '@mui/icons-material';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';

interface CommunityHighlightsSidebarProps {
  profession: string;
}

export const CommunityHighlightsSidebar: React.FC<CommunityHighlightsSidebarProps> = ({
  profession,
}) => {
  const { getProfessionDisplayName } = useDynamicProfessions();

  return (
    <Card
      sx={{
        position: 'sticky',
        top: 20,
        borderRadius: 4,
        background:
          'linear-gradient(180deg, rgba(13, 18, 27, 0.94), rgba(8, 12, 18, 0.94))',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.36)',
        color: 'rgba(248, 241, 231, 0.92)',
      }}
    >
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
          Hva venter deg
        </Typography>
        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.08)' }} />

        <Stack spacing={2}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'rgba(245, 166, 35, 0.14)',
                border: '1px solid rgba(245, 166, 35, 0.18)',
                flexShrink: 0,
              }}
            >
              <Forum sx={{ color: '#f5a623' }} />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ color: 'rgba(248, 241, 231, 0.92)' }}>
                Diskusjoner
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(248, 241, 231, 0.64)' }}>
                Få råd fra erfarne creators
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'rgba(245, 166, 35, 0.14)',
                border: '1px solid rgba(245, 166, 35, 0.18)',
                flexShrink: 0,
              }}
            >
              <Lightbulb sx={{ color: '#f5a623' }} />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ color: 'rgba(248, 241, 231, 0.92)' }}>
                Deling av kunnskap
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(248, 241, 231, 0.64)' }}>
                Del dine egne tips og triks
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'rgba(245, 166, 35, 0.14)',
                border: '1px solid rgba(245, 166, 35, 0.18)',
                flexShrink: 0,
              }}
            >
              <EmojiEvents sx={{ color: '#f5a623' }} />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ color: 'rgba(248, 241, 231, 0.92)' }}>
                Merker & belønninger
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(248, 241, 231, 0.64)' }}>
                Tjen merker ved å være aktiv
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'rgba(245, 166, 35, 0.14)',
                border: '1px solid rgba(245, 166, 35, 0.18)',
                flexShrink: 0,
              }}
            >
              <Group sx={{ color: '#f5a623' }} />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ color: 'rgba(248, 241, 231, 0.92)' }}>
                Nettverk
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(248, 241, 231, 0.64)' }}>
                Koble deg til andre creators
              </Typography>
            </Box>
          </Box>
        </Stack>

        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.08)' }} />

        <Typography variant="caption" sx={{ color: 'rgba(248, 241, 231, 0.64)' }}>
          Bli med i {getProfessionDisplayName(profession)} gruppen og få tilgang til eksklusive kanaler!
        </Typography>
      </CardContent>
    </Card>
  );
};

export default CommunityHighlightsSidebar;
