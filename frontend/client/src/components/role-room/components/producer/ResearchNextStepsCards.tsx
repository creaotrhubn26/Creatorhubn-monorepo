/**
 * ResearchNextStepsCards — items #26 (three big action cards), #27
 * (what-you-can-do-now checklist), #29 (missing fields with Fill-in
 * action). Sits in the Research Complete overlay just above the
 * primary CTA, so the user immediately sees what to do next without
 * hunting for buttons.
 *
 * Three card slots:
 *   1. Generate Marketing Plan      — primary; gates on readiness
 *   2. Invite team member            — secondary
 *   3. Export to Notion              — tertiary
 *
 * Checklist items mirror the marketing-plan readiness gate
 * (role-room-marketing-plan.ts:65) so the user knows exactly what's
 * blocking plan-generation. Missing fields render as red chips with a
 * "Fill in"-link that scrolls to / opens the relevant edit field.
 */

import React, { useEffect, useState } from 'react';
import { Box, Button, Chip, Stack, Tooltip, Typography } from '@mui/material';
import {
  AutoAwesome as MarketingPlanIcon,
  PersonAdd as InviteIcon,
  IntegrationInstructions as NotionIcon,
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as UncheckedIcon,
  Edit as EditIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import type { RoleRoomAgentProducerBootstrapResult } from '../../services/roleRoomAgentService';
import authSessionService from '../../services/authSessionService';

interface ChecklistItem {
  label: string;
  done: boolean;
  /** When defined, missing-state shows a "Fill in"-link scrolling to
   *  this DOM id (set on the actual edit field somewhere upstream). */
  fillInTargetId?: string;
}

interface ResearchNextStepsCardsProps {
  result: RoleRoomAgentProducerBootstrapResult;
  /** Called when user clicks "Generate Marketing Plan". Disabled when
   *  readiness gate isn't met. */
  onGenerateMarketingPlan?: () => void;
  /** Called when user clicks "Invite team member". When omitted the
   *  card renders as a passive hint with a "Coming soon"-tag. */
  onInviteTeam?: () => void;
  /** Called when user clicks "Export to Notion". When omitted shows
   *  Coming soon. */
  onExportToNotion?: () => void;
}

interface CostEstimate {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostNok: number;
  remainingCalls: number | null;
  entitlementStatus: string | null;
}

const ResearchNextStepsCards: React.FC<ResearchNextStepsCardsProps> = ({
  result,
  onGenerateMarketingPlan,
  onInviteTeam,
  onExportToNotion,
}) => {
  const profile = result.companyProfile;

  // Items #48 + #49 — fetch cost estimate + remaining quota on mount.
  // Best-effort: hides badges if endpoint fails. Doesn't block CTA.
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null);
  useEffect(() => {
    const profileFields = [
      profile?.companyName, profile?.industry, profile?.subIndustry,
      profile?.businessModel, profile?.summary, profile?.logoUrl,
      ...(profile?.offerings ?? []), ...(profile?.targetAudience ?? []),
      ...(profile?.toneAndBrandSignals ?? []),
    ].filter(Boolean).length;
    const competitors = result.competitorAnalysis?.competitors?.length ?? 0;
    const url = `/api/role-room/agent/research/cost-estimate?profileFields=${profileFields}&competitors=${competitors}`;
    let cancelled = false;
    fetch(url, { headers: authSessionService.getAuthHeadersSync() })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled || !data || !data.success) return;
        setCostEstimate({
          estimatedInputTokens: data.estimatedInputTokens,
          estimatedOutputTokens: data.estimatedOutputTokens,
          estimatedCostNok: data.estimatedCostNok,
          remainingCalls: data.remainingCalls,
          entitlementStatus: data.entitlementStatus,
        });
      })
      .catch(() => { /* hide badges silently */ });
    return () => { cancelled = true; };
  }, [profile, result.competitorAnalysis]);
  // Mirror the marketing-plan readiness gate from
  // role-room-marketing-plan.ts:65. Keep the labels identical so users
  // see the same wording in both surfaces.
  const checklist: ChecklistItem[] = [
    {
      label: 'Bedriftsnavn',
      done: Boolean(profile?.companyName),
      fillInTargetId: 'role-room-field-company-name',
    },
    {
      label: 'Bransje',
      done: Boolean(profile?.industry),
      fillInTargetId: 'role-room-field-industry',
    },
    {
      label: 'Minst én målgruppe',
      done: (profile?.targetAudience?.length ?? 0) >= 1,
      fillInTargetId: 'role-room-field-target-audience',
    },
    {
      label: 'Minst tre tone-signaler',
      done: (profile?.toneAndBrandSignals?.length ?? 0) >= 3,
      fillInTargetId: 'role-room-field-tone',
    },
    {
      label: 'Forretningsmål (storyLogic)',
      done: Boolean((result.storyLogicDraft as { contentStoryLogic?: { businessObjective?: string } } | undefined)?.contentStoryLogic?.businessObjective),
      fillInTargetId: 'role-room-field-story-objective',
    },
    {
      label: 'Målgruppeproblem (storyLogic)',
      done: Boolean((result.storyLogicDraft as { contentStoryLogic?: { audienceProblem?: string } } | undefined)?.contentStoryLogic?.audienceProblem),
      fillInTargetId: 'role-room-field-story-problem',
    },
    {
      label: 'Nøkkelløfte (storyLogic)',
      done: Boolean((result.storyLogicDraft as { contentStoryLogic?: { keyPromise?: string } } | undefined)?.contentStoryLogic?.keyPromise),
      fillInTargetId: 'role-room-field-story-promise',
    },
  ];
  const missingItems = checklist.filter((c) => !c.done);
  const ready = missingItems.length === 0;

  const handleFillIn = (targetId: string): void => {
    // Try to find the field; fall back silently if it isn't on screen
    // (e.g. user opened overlay without research-tab being mounted).
    requestAnimationFrame(() => {
      const target = document.getElementById(targetId) as HTMLElement | null;
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof (target as HTMLInputElement).focus === 'function') {
        (target as HTMLInputElement).focus({ preventScroll: true });
      }
    });
  };

  return (
    <Box
      sx={{
        p: 1.6,
        borderRadius: 3,
        border: '1px solid rgba(99,102,241,0.24)',
        bgcolor: 'rgba(30,27,75,0.36)',
        mb: 2,
      }}
    >
      <Typography sx={{ color: '#f8fafc', fontWeight: 800, mb: 1.4 }}>
        Hva vil du gjøre nå?
      </Typography>

      {/* Three action cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: 1.2,
          mb: 1.6,
        }}
      >
        {/* Card 1: Generate Marketing Plan — primary, gated */}
        <Tooltip
          title={
            ready
              ? 'Genererer strategi + 3-5 pillars + KPI-mål basert på research-resultatet.'
              : `Trenger ${missingItems.length} flere felt før plan kan genereres. Se sjekklisten under.`
          }
          placement="top"
        >
          <Box>
            <Button
              fullWidth
              disabled={!ready || !onGenerateMarketingPlan}
              onClick={onGenerateMarketingPlan}
              sx={{
                p: 1.6,
                height: '100%',
                bgcolor: ready ? 'rgba(99,102,241,0.22)' : 'rgba(148,163,184,0.1)',
                border: ready ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(148,163,184,0.2)',
                color: ready ? '#e0e7ff' : 'rgba(226,232,240,0.5)',
                textTransform: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 0.6,
                '&:hover': ready ? { bgcolor: 'rgba(99,102,241,0.32)' } : {},
              }}
            >
              <MarketingPlanIcon sx={{ color: ready ? '#a5b4fc' : 'rgba(226,232,240,0.4)' }} />
              <Typography sx={{ fontWeight: 800, fontSize: '0.96rem', textAlign: 'left' }}>
                Generer Marketing Plan
              </Typography>
              <Typography sx={{ fontSize: '0.74rem', color: 'rgba(226,232,240,0.6)', textAlign: 'left' }}>
                {ready ? 'Klar — strategi + pillars + KPI' : `${missingItems.length} felt mangler`}
              </Typography>
              {costEstimate ? (
                <Stack direction="row" spacing={0.4} flexWrap="wrap" useFlexGap sx={{ mt: 0.4 }}>
                  <Tooltip
                    title={`Estimert: ~${(costEstimate.estimatedInputTokens / 1000).toFixed(1)}k input + ~${(costEstimate.estimatedOutputTokens / 1000).toFixed(1)}k output tokens via Claude Sonnet 4.5`}
                  >
                    <Chip
                      size="small"
                      label={`~kr ${costEstimate.estimatedCostNok.toFixed(2)}`}
                      sx={{
                        height: 18,
                        fontSize: '0.66rem',
                        bgcolor: 'rgba(99,102,241,0.16)',
                        color: '#c7d2fe',
                        fontFamily: 'monospace',
                      }}
                    />
                  </Tooltip>
                  {costEstimate.remainingCalls !== null ? (
                    <Tooltip
                      title={`Du har ${costEstimate.remainingCalls} AI-kall igjen i ${costEstimate.entitlementStatus ?? 'denne perioden'}`}
                    >
                      <Chip
                        size="small"
                        label={`${costEstimate.remainingCalls} igjen`}
                        sx={{
                          height: 18,
                          fontSize: '0.66rem',
                          bgcolor: costEstimate.remainingCalls > 0 ? 'rgba(34,197,94,0.16)' : 'rgba(239,68,68,0.16)',
                          color: costEstimate.remainingCalls > 0 ? '#bbf7d0' : '#fecaca',
                          fontFamily: 'monospace',
                        }}
                      />
                    </Tooltip>
                  ) : null}
                </Stack>
              ) : null}
            </Button>
          </Box>
        </Tooltip>

        {/* Card 2: Invite team */}
        <Button
          fullWidth
          disabled={!onInviteTeam}
          onClick={onInviteTeam}
          sx={{
            p: 1.6,
            height: '100%',
            bgcolor: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.32)',
            color: '#bbf7d0',
            textTransform: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 0.6,
            '&:hover': onInviteTeam ? { bgcolor: 'rgba(34,197,94,0.18)' } : {},
            '&.Mui-disabled': { color: 'rgba(187,247,208,0.5)' },
          }}
        >
          <InviteIcon sx={{ color: '#34d399' }} />
          <Typography sx={{ fontWeight: 800, fontSize: '0.96rem', textAlign: 'left' }}>
            Inviter teammedlem
          </Typography>
          <Typography sx={{ fontSize: '0.74rem', color: 'rgba(226,232,240,0.6)', textAlign: 'left' }}>
            {onInviteTeam ? 'Del research med kollega' : 'Kommer snart'}
          </Typography>
        </Button>

        {/* Card 3: Export to Notion */}
        <Button
          fullWidth
          disabled={!onExportToNotion}
          onClick={onExportToNotion}
          sx={{
            p: 1.6,
            height: '100%',
            bgcolor: 'rgba(251,191,36,0.1)',
            border: '1px solid rgba(251,191,36,0.32)',
            color: '#fde68a',
            textTransform: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 0.6,
            '&:hover': onExportToNotion ? { bgcolor: 'rgba(251,191,36,0.18)' } : {},
            '&.Mui-disabled': { color: 'rgba(253,230,138,0.5)' },
          }}
        >
          <NotionIcon sx={{ color: '#fbbf24' }} />
          <Typography sx={{ fontWeight: 800, fontSize: '0.96rem', textAlign: 'left' }}>
            Eksporter til Notion
          </Typography>
          <Typography sx={{ fontSize: '0.74rem', color: 'rgba(226,232,240,0.6)', textAlign: 'left' }}>
            {onExportToNotion ? 'Synk til Notion-database' : 'Kommer snart'}
          </Typography>
        </Button>
      </Box>

      {/* Checklist — what's needed before marketing plan can run */}
      <Box>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.6 }}>
          <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.84rem' }}>
            Sjekkliste for marketing plan
          </Typography>
          <Chip
            size="small"
            label={`${checklist.length - missingItems.length}/${checklist.length}`}
            sx={{
              bgcolor: ready ? 'rgba(52,211,153,0.18)' : 'rgba(251,191,36,0.18)',
              color: ready ? '#bbf7d0' : '#fde68a',
              fontFamily: 'monospace',
              fontWeight: 700,
              height: 18,
            }}
          />
        </Stack>
        <Stack spacing={0.3}>
          {checklist.map((item) => (
            <Stack
              key={item.label}
              direction="row"
              alignItems="center"
              spacing={0.8}
              sx={{
                px: 0.6,
                py: 0.3,
                borderRadius: 1,
                '&:hover': item.done ? {} : { bgcolor: 'rgba(239,68,68,0.06)' },
              }}
            >
              {item.done ? (
                <CheckIcon sx={{ color: '#34d399', fontSize: 16 }} />
              ) : (
                <UncheckedIcon sx={{ color: 'rgba(226,232,240,0.4)', fontSize: 16 }} />
              )}
              <Typography
                sx={{
                  color: item.done ? 'rgba(226,232,240,0.7)' : '#fecaca',
                  fontSize: '0.82rem',
                  textDecoration: item.done ? 'none' : 'none',
                  flex: 1,
                }}
              >
                {item.label}
              </Typography>
              {!item.done && item.fillInTargetId ? (
                <Button
                  size="small"
                  startIcon={<EditIcon sx={{ fontSize: 12 }} />}
                  endIcon={<ChevronRightIcon sx={{ fontSize: 14 }} />}
                  onClick={() => handleFillIn(item.fillInTargetId!)}
                  sx={{
                    textTransform: 'none',
                    color: '#fca5a5',
                    fontSize: '0.72rem',
                    py: 0,
                    px: 0.6,
                    minWidth: 0,
                    '&:hover': { bgcolor: 'rgba(239,68,68,0.12)' },
                  }}
                >
                  Fyll inn
                </Button>
              ) : null}
            </Stack>
          ))}
        </Stack>
      </Box>
    </Box>
  );
};

export default ResearchNextStepsCards;
