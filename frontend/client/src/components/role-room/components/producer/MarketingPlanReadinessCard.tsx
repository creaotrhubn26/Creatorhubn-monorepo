/**
 * MarketingPlanReadinessCard — «Klar-sjekk» før markedsplan-generering.
 * Porter mp-readiness-designet: Agent-merke, hvem planen lages for, en
 * 4-stegs sjekkliste (Kundeprofil, Branding, Mål og KPI, Kanaler) med
 * ok/pending-status, «X av 4 klart»-teller og Generer-knapp.
 *
 * Kategoriene utledes av bootstrap + readiness; selve gaten følger
 * readiness.ready (server-autoritativt, samme som før).
 */

import * as React from 'react';
import { Box, Stack, Typography, Button, CircularProgress } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CampaignIcon from '@mui/icons-material/Campaign';
import PersonPinIcon from '@mui/icons-material/PersonPin';
import PaletteIcon from '@mui/icons-material/Palette';
import FlagIcon from '@mui/icons-material/Flag';
import HubIcon from '@mui/icons-material/Hub';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import type {
  RoleRoomAgentProducerBootstrapResult,
  MarketingPlanReadiness,
} from '../../services/roleRoomAgentService';

const ACCENT = '#a78bfa';
const GRAD = 'linear-gradient(135deg, #a855f7, #d946ef)';
const INK = '#f5f3ff';
const MUTED = 'rgba(226,232,240,0.62)';

export interface MarketingPlanReadinessCardProps {
  bootstrap: RoleRoomAgentProducerBootstrapResult | null;
  readiness: MarketingPlanReadiness | null;
  generating: boolean;
  onGenerate: () => void;
}

interface CheckItem {
  key: string;
  icon: React.ReactElement;
  title: string;
  desc: string;
  ok: boolean;
}

export default function MarketingPlanReadinessCard({
  bootstrap, readiness, generating, onGenerate,
}: MarketingPlanReadinessCardProps): React.ReactElement {
  const cp = bootstrap?.companyProfile;
  const brand = bootstrap?.planningDraft?.brandGuide;
  const logic = bootstrap?.planningDraft?.contentLogic;
  const activation = bootstrap?.planningDraft?.activationPlan;

  const companyName = cp?.companyName?.trim() || null;
  const logoUrl = cp?.logoUrl || brand?.logoUrl || null;

  const checks: CheckItem[] = [
    {
      key: 'profile', icon: <PersonPinIcon sx={{ fontSize: 18 }} />, title: 'Kundeprofil',
      desc: 'Målgruppe, tone og posisjonering definert',
      ok: Boolean(cp?.companyName && (cp?.targetAudience?.length ?? 0) > 0 && (cp?.toneAndBrandSignals?.length ?? 0) >= 3 && cp?.industry),
    },
    {
      key: 'branding', icon: <PaletteIcon sx={{ fontSize: 18 }} />, title: 'Branding',
      desc: 'Logo, farger og visuell stil lastet opp',
      ok: Boolean(logoUrl || (brand?.colors?.length ?? 0) > 0),
    },
    {
      key: 'goals', icon: <FlagIcon sx={{ fontSize: 18 }} />, title: 'Mål og KPI',
      desc: 'Vekstmål for rekkevidde og leads satt',
      ok: Boolean(logic?.objective || activation?.businessGoal || (activation?.successSignals?.length ?? 0) > 0),
    },
    {
      key: 'channels', icon: <HubIcon sx={{ fontSize: 18 }} />, title: 'Kanaler',
      desc: 'Koble til Instagram, LinkedIn og TikTok',
      ok: Boolean(readiness?.hasInstagramConnection),
    },
  ];

  const okCount = checks.filter((c) => c.ok).length;
  const total = checks.length;
  const ready = Boolean(readiness?.ready);

  return (
    <Box
      sx={{
        position: 'relative', borderRadius: 3, p: { xs: 2, md: 2.8 }, overflow: 'hidden',
        border: '1px solid rgba(167,139,250,0.2)',
        background:
          'radial-gradient(120% 90% at 8% -10%, rgba(168,85,247,0.20), transparent 55%), radial-gradient(110% 80% at 100% 114%, rgba(217,70,239,0.14), transparent 50%), linear-gradient(180deg, #0a0a14 0%, #100923 55%, #1a0f2e 100%)',
        boxShadow: '0 18px 48px rgba(124,58,237,0.26)',
      }}
    >
      {/* Agent-merke */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.6 }}>
        <Box sx={{ width: 28, height: 28, borderRadius: 1.4, display: 'grid', placeItems: 'center', background: GRAD, boxShadow: '0 6px 16px rgba(168,85,247,0.45)' }}>
          <AutoAwesomeIcon sx={{ fontSize: 16, color: '#fff' }} />
        </Box>
        <Typography sx={{ fontWeight: 700, fontSize: 12.5, letterSpacing: '0.5px', background: 'linear-gradient(135deg, #c4b5fd, #f0abfc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          The Role Room Agent
        </Typography>
      </Stack>

      {/* Tittel + eyebrow */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.6 }}>
        <CampaignIcon sx={{ fontSize: 18, color: ACCENT }} />
        <Typography sx={{ textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 700, fontSize: 11, color: ACCENT }}>
          Markedsplan · Klar-sjekk
        </Typography>
      </Stack>
      <Typography sx={{ fontWeight: 800, fontSize: 21, color: INK, letterSpacing: '-0.3px', lineHeight: 1.12, mb: 0.5 }}>
        Er alt klart for å generere planen?
      </Typography>
      <Typography sx={{ fontSize: 13.5, color: MUTED, lineHeight: 1.5, mb: 1.6 }}>
        Agenten trenger disse byggesteinene før den lager en skreddersydd 30-dagers innholdsstrategi.
      </Typography>

      {/* Hvem planen lages for */}
      <Stack
        direction="row" alignItems="center" spacing={1.2}
        sx={{ mb: 2, p: 1.2, borderRadius: 2.2, bgcolor: 'rgba(15,23,42,0.5)', border: '1px solid rgba(167,139,250,0.22)' }}
      >
        {logoUrl ? (
          <Box component="img" src={logoUrl} alt="" sx={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, bgcolor: '#fff' }} />
        ) : (
          <Box sx={{ width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', background: GRAD, color: '#fff', fontWeight: 800, fontSize: 17, flexShrink: 0 }}>
            {(companyName || '?').charAt(0).toUpperCase()}
          </Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: ACCENT, textTransform: 'uppercase' }}>Plan for</Typography>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {companyName || 'Kjør Research-analysen først'}
          </Typography>
          {cp?.industry ? <Typography sx={{ fontSize: 12, color: MUTED }}>{cp.industry}</Typography> : null}
        </Box>
      </Stack>

      {/* Sjekkliste */}
      <Stack spacing={1} sx={{ mb: 2 }}>
        {checks.map((c) => (
          <Stack
            key={c.key} direction="row" alignItems="center" spacing={1.2}
            sx={{ p: 1.2, borderRadius: 2, bgcolor: 'rgba(15,23,42,0.45)', border: '1px solid rgba(148,163,184,0.12)' }}
          >
            <Box sx={{ width: 34, height: 34, borderRadius: 1.6, display: 'grid', placeItems: 'center', flexShrink: 0, color: c.ok ? '#fff' : ACCENT, background: c.ok ? GRAD : 'rgba(168,85,247,0.12)' }}>
              {c.icon}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: INK }}>{c.title}</Typography>
              <Typography sx={{ fontSize: 12, color: MUTED, lineHeight: 1.4 }}>{c.desc}</Typography>
            </Box>
            <Box
              sx={{
                width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0,
                bgcolor: c.ok ? 'rgba(52,211,153,0.18)' : 'rgba(250,204,21,0.16)',
                color: c.ok ? '#34d399' : '#fbbf24',
              }}
            >
              {c.ok ? <CheckRoundedIcon sx={{ fontSize: 16 }} /> : <PriorityHighIcon sx={{ fontSize: 15 }} />}
            </Box>
          </Stack>
        ))}
      </Stack>

      {/* Teller + Generer */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.4}>
        <Stack direction="row" alignItems="baseline" spacing={0.7}>
          <Typography sx={{ fontSize: 20, fontWeight: 800, color: okCount === total ? '#34d399' : INK, lineHeight: 1 }}>{okCount} av {total}</Typography>
          <Typography sx={{ fontSize: 12.5, color: MUTED }}>klart</Typography>
        </Stack>
        <Button
          onClick={onGenerate}
          disabled={generating || !ready}
          variant="contained" disableElevation
          startIcon={generating ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <AutoAwesomeIcon />}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, background: GRAD, color: '#fff', '&:hover': { background: GRAD, filter: 'brightness(1.06)' }, '&.Mui-disabled': { background: 'rgba(168,85,247,0.25)', color: 'rgba(245,243,255,0.5)' } }}
        >
          {generating ? 'Genererer…' : 'Generer plan'}
        </Button>
      </Stack>
    </Box>
  );
}
