/**
 * GuidesDrawer — kontekstuell hjelp for hvordan spille inn en god self-tape.
 *
 * Statisk innhold for Fase B-2 (5 seksjoner med konkrete tips).
 * Senere kan dette hentes fra Admin Room CMS for sentralt vedlikehold.
 */
import { useMemo } from 'react';
import {
  Box, Drawer, IconButton, Stack, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
import GraphicEqOutlinedIcon from '@mui/icons-material/GraphicEqOutlined';
import WbIncandescentOutlinedIcon from '@mui/icons-material/WbIncandescentOutlined';
import CropFreeOutlinedIcon from '@mui/icons-material/CropFreeOutlined';
import RecordVoiceOverOutlinedIcon from '@mui/icons-material/RecordVoiceOverOutlined';

import { palette, radius } from '../../../theme';
import { useT } from '../../../../../../i18n';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Section {
  title: string;
  Icon: React.ComponentType<{ sx?: object; fontSize?: 'small' | 'inherit' | 'medium' | 'large' }>;
  tips: string[];
}

export default function GuidesDrawer({ open, onClose }: Props) {
  const { t } = useT();

  const SECTIONS: Section[] = useMemo(() => [
    {
      title: t('guidesDrawer.cameraTitle'),
      Icon: CameraAltOutlinedIcon,
      tips: [
        t('guidesDrawer.cameraTip1'),
        t('guidesDrawer.cameraTip2'),
        t('guidesDrawer.cameraTip3'),
        t('guidesDrawer.cameraTip4'),
      ],
    },
    {
      title: t('guidesDrawer.audioTitle'),
      Icon: GraphicEqOutlinedIcon,
      tips: [
        t('guidesDrawer.audioTip1'),
        t('guidesDrawer.audioTip2'),
        t('guidesDrawer.audioTip3'),
        t('guidesDrawer.audioTip4'),
      ],
    },
    {
      title: t('guidesDrawer.lightingTitle'),
      Icon: WbIncandescentOutlinedIcon,
      tips: [
        t('guidesDrawer.lightingTip1'),
        t('guidesDrawer.lightingTip2'),
        t('guidesDrawer.lightingTip3'),
        t('guidesDrawer.lightingTip4'),
      ],
    },
    {
      title: t('guidesDrawer.framingTitle'),
      Icon: CropFreeOutlinedIcon,
      tips: [
        t('guidesDrawer.framingTip1'),
        t('guidesDrawer.framingTip2'),
        t('guidesDrawer.framingTip3'),
        t('guidesDrawer.framingTip4'),
      ],
    },
    {
      title: t('guidesDrawer.actingTitle'),
      Icon: RecordVoiceOverOutlinedIcon,
      tips: [
        t('guidesDrawer.actingTip1'),
        t('guidesDrawer.actingTip2'),
        t('guidesDrawer.actingTip3'),
        t('guidesDrawer.actingTip4'),
      ],
    },
  ], [t]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 460 },
          bgcolor: palette.bgShell,
          color: palette.textPrimary,
          borderLeft: `1px solid ${palette.border}`,
        },
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>{t('guidesDrawer.title')}</Typography>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
            {t('guidesDrawer.subtitle')}
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: palette.textMuted }}>
          <CloseIcon />
        </IconButton>
      </Stack>
      <Box sx={{ p: 2, pt: 0 }}>
        <Stack spacing={2.4}>
          {SECTIONS.map((s) => (
            <Box
              key={s.title}
              sx={{
                bgcolor: palette.bgCard,
                border: `1px solid ${palette.borderSubtle}`,
                borderRadius: radius.lg,
                p: 2,
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.2 }}>
                <s.Icon sx={{ color: palette.accentBright, fontSize: 'small' }} />
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                  {s.title}
                </Typography>
              </Stack>
              <Stack spacing={0.8} sx={{ pl: 0.2 }}>
                {s.tips.map((tip) => (
                  <Box
                    key={tip}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr',
                      gap: 1,
                      alignItems: 'flex-start',
                    }}
                  >
                    <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: palette.accentBright, mt: 0.8 }} />
                    <Typography sx={{ color: palette.textSecondary, fontSize: '0.86rem', lineHeight: 1.5 }}>
                      {tip}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </Box>
    </Drawer>
  );
}
