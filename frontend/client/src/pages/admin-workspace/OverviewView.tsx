/**
 * OverviewView — «Oversikt»-flaten.
 *
 * Hurtigvalg-rutenettet som hopper videre til verktøyene. Flyttet ut av
 * AdminWorkspace.tsx sammen med panel-registeret.
 */

import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LeaderboardOutlinedIcon from '@mui/icons-material/LeaderboardOutlined';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import SsidChartOutlinedIcon from '@mui/icons-material/SsidChartOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';

import { BRAND } from './brand';
import { ADMIN_PRODUCTS, type AdminProductId, type WorkspaceItemId } from './workspaceItems';


export function OverviewView({
  onJumpTo,
  product,
}: {
  onJumpTo: (id: WorkspaceItemId) => void;
  product: AdminProductId;
}) {
  const cards: { id: WorkspaceItemId; label: string; description: string; icon: ReactNode }[] = [
    {
      id: 'business-plan',
      label: 'Forretningsplan',
      description: 'BBI-strukturert plan, autosave + Claude-generering per felt.',
      icon: <ArticleOutlinedIcon />,
    },
    {
      id: 'industry-crm',
      label: 'Tier-1 outreach (CRM)',
      description: 'Bransje-mål, produksjoner og kontakt-pipeline.',
      icon: <LeaderboardOutlinedIcon />,
    },
    {
      id: 'business-dna',
      label: 'Business DNA',
      description: 'Lim inn URL → merkevaren din + første kampanje, med dine egne bilder.',
      icon: <AutoAwesomeOutlinedIcon />,
    },
    {
      id: 'marketing-catalog',
      label: 'Katalog',
      description: 'Produkter og vertikaler kampanjene trekker fra — auto-oppdaget fra systemet.',
      icon: <Inventory2OutlinedIcon />,
    },
    {
      id: 'marketing-segments',
      label: 'Målgrupper',
      description: 'Segmenter → synkroniserte Google/Meta/LinkedIn-audiences.',
      icon: <GroupsOutlinedIcon />,
    },
    {
      id: 'marketing-cockpit',
      label: 'Marketing Cockpit',
      description: 'B2B-funnel, content-kalender, Claude lead-scoring.',
      icon: <CampaignOutlinedIcon />,
    },
    {
      id: 'role-room-agent',
      label: 'Role Room Agent',
      description: 'AI-assistent for research, kampanjer og innholds-utkast.',
      icon: <SmartToyOutlinedIcon />,
    },
    {
      id: 'operating-system',
      label: 'Operativsystem',
      description: 'Bransje-organisasjoner og kvalitets-partnere.',
      icon: <HubOutlinedIcon />,
    },
    {
      id: 'ai-citation',
      label: 'GEO-effekt',
      description: 'AI-citation-måling for søkemotor-LLM-svar.',
      icon: <SsidChartOutlinedIcon />,
    },
    {
      id: 'newsletter-studio',
      label: 'Newsletter Studio',
      description: 'Block-builder, segmenter og AI-genererte emnefelter.',
      icon: <EmailOutlinedIcon />,
    },
    {
      id: 'migrations',
      label: 'Migrasjoner',
      description: 'Pending DB-migrasjoner + auto-detect + trigger.',
      icon: <StorageOutlinedIcon />,
    },
  ];

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          p: 3,
          borderRadius: 3,
          background:
            product === 'leadgrid'
              ? 'linear-gradient(135deg, rgba(34,211,238,0.18), rgba(167,139,250,0.10))'
              : 'linear-gradient(135deg, rgba(167,139,250,0.18), rgba(124,58,237,0.08))',
          border: `1px solid ${BRAND.border}`,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <RocketLaunchOutlinedIcon sx={{ color: BRAND.accent, fontSize: 28 }} />
          <Box>
            <Typography sx={{ color: BRAND.text, fontWeight: 800, fontSize: '1.2rem' }}>
              Velkommen tilbake, Daniel
            </Typography>
            <Typography sx={{ color: BRAND.textMuted, fontSize: '0.88rem' }}>
              Aktivt produkt:{' '}
              <strong style={{ color: BRAND.text }}>
                {ADMIN_PRODUCTS.find((p) => p.id === product)?.label}
              </strong>
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box>
        <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '0.96rem', mb: 1.5 }}>
          Hurtigvalg
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
              lg: 'repeat(4, 1fr)',
            },
            gap: 1.5,
          }}
        >
          {cards.map((c) => (
            <Box
              key={c.id}
              onClick={() => onJumpTo(c.id)}
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: BRAND.panelBg,
                border: `1px solid ${BRAND.border}`,
                cursor: 'pointer',
                transition: 'transform 120ms ease, border-color 120ms ease',
                '&:hover': {
                  borderColor: BRAND.borderHover,
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 24px rgba(124, 58, 237, 0.18)',
                },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1.5,
                    bgcolor: 'rgba(167, 139, 250, 0.14)',
                    color: BRAND.accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    '& svg': { fontSize: 18 },
                  }}
                >
                  {c.icon}
                </Box>
                <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '0.88rem' }}>
                  {c.label}
                </Typography>
              </Stack>
              <Typography sx={{ color: BRAND.textMuted, fontSize: '0.76rem', lineHeight: 1.4 }}>
                {c.description}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Stack>
  );
}

export default OverviewView;
