import { useMemo, type ElementType } from 'react';
import {
  ArrowForward as ArrowForwardIcon,
  AssignmentIndOutlined as RolesIcon,
  EventAvailableOutlined as AuditionsIcon,
  FactCheckOutlined as EvidenceIcon,
  GroupsOutlined as CandidatesIcon,
  HowToRegOutlined as SelectionIcon,
  PersonSearchOutlined as TalentsIcon,
  SpaceDashboardOutlined as FullWorkspaceIcon,
} from '@mui/icons-material';
import { Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import type { Candidate, CastingProject, Role, Schedule } from '../../models/casting';
import { MOBILE_TOUCH_TARGET_SIZE, TOUCH_TARGET_SIZE, focusVisibleStyles } from '../../constants/accessibility';
import { roleTokens } from '../../theme/roleTokens';
import { useScreenTier } from '../production/useScreenTier';
import { buildCastingWorkspaceBrief, type CastingWorkspaceTarget } from './castingWorkspaceModel';

interface CastingWorkspaceProps {
  project: CastingProject;
  roles: Role[];
  candidates: Candidate[];
  schedules: Schedule[];
  readOnly?: boolean;
  onNavigate: (target: CastingWorkspaceTarget) => void;
  onOpenFullWorkspace: () => void;
}

const TARGETS: ReadonlyArray<{ target: CastingWorkspaceTarget; label: string; icon: ElementType }> = [
  { target: 'roles', label: 'Roller', icon: RolesIcon },
  { target: 'talents', label: 'Talenter', icon: TalentsIcon },
  { target: 'candidates', label: 'Kandidater', icon: CandidatesIcon },
  { target: 'auditions', label: 'Auditions', icon: AuditionsIcon },
  { target: 'selection', label: 'Utvelgelse', icon: SelectionIcon },
];

const TONES = {
  attention: { color: '#fcd34d', background: 'rgba(245,158,11,.08)', border: 'rgba(245,158,11,.26)' },
  active: { color: '#f9a8d4', background: 'rgba(236,72,153,.08)', border: 'rgba(236,72,153,.24)' },
  ready: { color: '#6ee7b7', background: 'rgba(16,185,129,.08)', border: 'rgba(16,185,129,.24)' },
  neutral: { color: roleTokens.textMuted, background: 'rgba(148,163,184,.06)', border: 'rgba(148,163,184,.18)' },
} as const;

export function CastingWorkspace({
  project,
  roles,
  candidates,
  schedules,
  readOnly = false,
  onNavigate,
  onOpenFullWorkspace,
}: CastingWorkspaceProps) {
  const { isMobile } = useScreenTier();
  const targetSize = isMobile ? MOBILE_TOUCH_TARGET_SIZE : TOUCH_TARGET_SIZE;
  const brief = useMemo(
    () => buildCastingWorkspaceBrief({ roles, candidates, schedules }),
    [candidates, roles, schedules],
  );

  return (
    <Box
      component="section"
      aria-labelledby="casting-workspace-title"
      data-testid="casting-workspace"
      sx={{ minHeight: '100%', overflowY: 'auto', bgcolor: '#090d14', color: roleTokens.text, p: { xs: 1.5, sm: 2, lg: 3 } }}
    >
      <Box sx={{ width: '100%', maxWidth: 1540, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', flexDirection: { xs: 'column', md: 'row' }, gap: 1.5, mb: 2 }}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: .5, flexWrap: 'wrap' }}>
              <Chip label="CASTINGROM" size="small" sx={{ height: 24, color: '#fbcfe8', bgcolor: 'rgba(236,72,153,.12)', border: '1px solid rgba(236,72,153,.28)', fontWeight: 800, letterSpacing: .7 }} />
              {readOnly ? <Chip label="Skrivebeskyttet" size="small" variant="outlined" /> : null}
            </Stack>
            <Typography id="casting-workspace-title" component="h1" sx={{ fontSize: { xs: '1.45rem', md: '1.9rem' }, fontWeight: 780 }}>
              {project.name}
            </Typography>
            <Typography sx={{ color: roleTokens.textMuted, mt: .25, maxWidth: 760 }}>
              Roller, kandidater, auditions og dokumenterte valg i én sammenhengende castingflyt.
            </Typography>
          </Box>
          <Button variant="outlined" startIcon={<FullWorkspaceIcon />} onClick={onOpenFullWorkspace} data-testid="casting-open-full-workspace" sx={{ minHeight: targetSize, color: roleTokens.text, borderColor: roleTokens.border, alignSelf: { xs: 'stretch', md: 'center' }, ...focusVisibleStyles }}>
            Hele prosjektet
          </Button>
        </Box>

        <Box component="nav" aria-label="Castingarbeidsflater" sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', xl: 'repeat(5, minmax(0, 1fr))' }, gap: 1, p: 1, mb: 2.5, border: `1px solid ${roleTokens.border}`, bgcolor: 'rgba(14,18,30,.92)', borderRadius: 2 }}>
          {TARGETS.map(({ target, label, icon: Icon }) => (
            <Button key={target} startIcon={<Icon sx={{ fontSize: 19 }} />} onClick={() => onNavigate(target)} data-testid={`casting-target-${target}`} sx={{ minHeight: targetSize, justifyContent: 'flex-start', px: 1.5, color: '#fbcfe8', border: '1px solid transparent', '&:hover': { bgcolor: 'rgba(236,72,153,.1)', borderColor: 'rgba(236,72,153,.22)' }, ...focusVisibleStyles }}>
              {label}
            </Button>
          ))}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.55fr) minmax(320px, .7fr)' }, gap: 2 }}>
          <Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1} sx={{ mb: 1.25 }}>
              <Box>
                <Typography component="h2" sx={{ fontSize: '1.08rem', fontWeight: 760 }}>Neste castingarbeid</Typography>
                <Typography sx={{ color: roleTokens.textMuted, fontSize: '.82rem' }}>Prioriteringen bygger bare på registrerte prosjektdata.</Typography>
              </Box>
              <Chip icon={<EvidenceIcon sx={{ color: '#6ee7b7 !important' }} />} label="Sporbart grunnlag" size="small" sx={{ color: '#a7f3d0', bgcolor: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)' }} />
            </Stack>
            <Stack spacing={1.25}>
              {brief.actions.map((action) => {
                const tone = TONES[action.tone];
                return (
                  <Card key={action.id} variant="outlined" data-testid={`casting-action-${action.id}`} sx={{ bgcolor: tone.background, borderColor: tone.border, color: roleTokens.text }}>
                    <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                      <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Chip label={action.evidence} size="small" sx={{ height: 22, mb: .75, color: tone.color, bgcolor: 'rgba(0,0,0,.18)', fontSize: '.68rem' }} />
                          <Typography component="h3" sx={{ fontSize: '.98rem', fontWeight: 740 }}>{action.title}</Typography>
                          <Typography sx={{ mt: .35, color: roleTokens.textMuted, fontSize: '.82rem', lineHeight: 1.5 }}>{action.description}</Typography>
                        </Box>
                        <Button endIcon={<ArrowForwardIcon />} onClick={() => onNavigate(action.target)} sx={{ minHeight: targetSize, flexShrink: 0, color: tone.color, justifyContent: { xs: 'space-between', sm: 'center' }, ...focusVisibleStyles }}>
                          Åpne
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </Box>

          <Box>
            <Typography component="h2" sx={{ fontSize: '1.08rem', fontWeight: 760, mb: 1.25 }}>Castingstatus</Typography>
            <Card variant="outlined" sx={{ bgcolor: roleTokens.surface, borderColor: roleTokens.border, color: roleTokens.text }}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
                  {[
                    { label: 'Roller', value: brief.stats.roleCount },
                    { label: 'Åpne roller', value: brief.stats.openRoleCount },
                    { label: 'Kandidater', value: brief.stats.candidateCount },
                    { label: 'Kortliste', value: brief.stats.shortlistCount },
                    { label: 'Valgt/bekreftet', value: brief.stats.selectedCount },
                    { label: 'Kommende auditions', value: brief.stats.scheduledAuditionCount },
                  ].map((stat) => (
                    <Box key={stat.label} sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.06)' }}>
                      <Typography sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' }, fontWeight: 780 }}>{stat.value}</Typography>
                      <Typography sx={{ color: roleTokens.textMuted, fontSize: '.72rem' }}>{stat.label}</Typography>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default CastingWorkspace;
