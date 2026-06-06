/**
 * GuidesDrawer — kontekstuell hjelp for hvordan spille inn en god self-tape.
 *
 * Statisk innhold for Fase B-2 (5 seksjoner med konkrete tips).
 * Senere kan dette hentes fra Admin Room CMS for sentralt vedlikehold.
 */
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

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Section {
  title: string;
  Icon: React.ComponentType<{ sx?: object; fontSize?: 'small' | 'inherit' | 'medium' | 'large' }>;
  tips: string[];
}

const SECTIONS: Section[] = [
  {
    title: 'Kamera',
    Icon: CameraAltOutlinedIcon,
    tips: [
      'Plasser kameraet i øyehøyde — ikke nedenfra.',
      'Bruk stativ eller stødig overflate. Hold-i-hånd zoomer fokus inn/ut.',
      'Skyt i 1080p eller bedre. 4K er overflødig for casting.',
      'Slå AV digital zoom — flytt kameraet nærmere isteden.',
    ],
  },
  {
    title: 'Lyd',
    Icon: GraphicEqOutlinedIcon,
    tips: [
      'Ta opp i et stille rom. Skru av AC, kjøleskap, varselslyder.',
      'Bruk ekstern mikrofon hvis du har — Lavalier eller shotgun gir 3× bedre lyd.',
      'Test nivå før du tar opp. Stemmen din skal ligge på -12dB til -6dB.',
      'Hvis du gjentar replikker — la 2 sekunder pause før neste forsøk.',
    ],
  },
  {
    title: 'Lyssetting',
    Icon: WbIncandescentOutlinedIcon,
    tips: [
      'Vend deg mot vinduet, ikke fra. Naturlig lys er gratis og pent.',
      'Unngå motlys (vindu bak deg) — ansiktet blir mørkt.',
      'En enkelt softbox foran og litt opp er en perfekt nøkkellys.',
      'Sjekk at det ikke er harde skygger under øynene eller på halsen.',
    ],
  },
  {
    title: 'Bilde-utsnitt',
    Icon: CropFreeOutlinedIcon,
    tips: [
      'Standard self-tape-utsnitt: midten av brystet til litt over toppen av hodet.',
      'Plasser øynene cirka 1/3 ned fra øverste kant.',
      'Hold blikket like ved siden av linsen — IKKE rett inn (med mindre regissøren ber om det).',
      'Nøytral bakgrunn — gråblå eller off-white. Ingen plakater eller rot.',
    ],
  },
  {
    title: 'Skuespill',
    Icon: RecordVoiceOverOutlinedIcon,
    tips: [
      'Begynn med slating (navn, høyde, agent) — kortfattet, naturlig.',
      'Slipp én pust før du starter. Det gir naturlig timing.',
      'Spill HØRT, ikke STORT. Kameraet ser alt — vær subtil.',
      'Hvis du har en off-screen-partner — be dem snakke lavt, så du ikke overdøver dem.',
    ],
  },
];

export default function GuidesDrawer({ open, onClose }: Props) {
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
          <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>Self-tape-guide</Typography>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
            Sjekk disse før du trykker REC.
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
