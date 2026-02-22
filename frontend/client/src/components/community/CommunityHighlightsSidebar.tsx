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
    <Card sx={{ position: 'sticky', top: 20 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Hva venter deg
        </Typography>
        <Divider sx={{ my: 2 }} />

        <Stack spacing={2}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Forum color="primary" />
            <Box>
              <Typography variant="subtitle2">Diskusjoner</Typography>
              <Typography variant="body2" color="text.secondary">
                Få råd fra erfarne creators
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Lightbulb color="primary" />
            <Box>
              <Typography variant="subtitle2">Deling av kunnskap</Typography>
              <Typography variant="body2" color="text.secondary">
                Del dine egne tips og triks
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <EmojiEvents color="primary" />
            <Box>
              <Typography variant="subtitle2">Badges & Belønninger</Typography>
              <Typography variant="body2" color="text.secondary">
                Tjen badges ved å være aktiv
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Group color="primary" />
            <Box>
              <Typography variant="subtitle2">Nettverk</Typography>
              <Typography variant="body2" color="text.secondary">
                Koble deg til andre creators
              </Typography>
            </Box>
          </Box>
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Typography variant="caption" color="text.secondary">
          Bli med i {getProfessionDisplayName(profession)} gruppen og få tilgang til eksklusive kanaler!
        </Typography>
      </CardContent>
    </Card>
  );
};

export default CommunityHighlightsSidebar;

