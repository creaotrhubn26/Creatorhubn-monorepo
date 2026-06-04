import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  LinearProgress,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  AlternateEmail as AlternateEmailIcon,
  Article as ArticleIcon,
  AutoFixHigh as AutoFixHighIcon,
  Chat as ChatIcon,
  CloudUpload as CloudUploadIcon,
  FactCheck as FactCheckIcon,
  GridView as GridViewIcon,
  Language as LanguageIcon,
  LocalMall as MerchIcon,
  MoveToInbox as InboxIcon,
  QueryStats as QueryStatsIcon,
  Rocket as RocketIcon,
  Tag as TagIcon,
} from '@mui/icons-material';
import RoleRoomResearchCompleteOverlay from './RoleRoomResearchCompleteOverlay';
import ResearchProgressLive from './ResearchProgressLive';
import type { ResearchStage, ResearchProgressStatus } from '../../hooks/useResearchProgress';
import MetaPagePublicMetadataInspector from './MetaPagePublicMetadataInspector';
import AdsAttributionInspector from './AdsAttributionInspector';
import FacebookVideoPublisher from './FacebookVideoPublisher';
import FacebookPageMentionPublisher from './FacebookPageMentionPublisher';
import SocialInboxPanel from './SocialInboxPanel';
import SocialAnalyticsPanel from './SocialAnalyticsPanel';
import RoleRoomAgentWorkflowStepper from './RoleRoomAgentWorkflowStepper';
import RoleRoomAgentConnectionsBar from './RoleRoomAgentConnectionsBar';
import SocialAccessRequestDialog from './SocialAccessRequestDialog';
import IgHashtagInspector from './IgHashtagInspector';
import PagePublicContentInspector from './PagePublicContentInspector';
import { Tab, Tabs } from '@mui/material';
import roleRoomAgentService, {
  type RoleRoomAgentAccess,
  type RoleRoomAgentProducerBootstrapResult,
} from '../../services/roleRoomAgentService';
import RoleRoomAgentChatPanel from '../ai/RoleRoomAgentChatPanel';
import RoleRoomFeedPlannerPanel from './RoleRoomFeedPlannerPanel';
import MarketingPlanPanel from './MarketingPlanPanel';
import ResearchVersionsPickerInline from './ResearchVersionsPickerInline';
import MerchSuppliersPanel from './MerchSuppliersPanel';

type RoleRoomAgentDialogProps = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  /** Optional — when provided, the Chat tab becomes available so desktop
   *  users can talk to the persistent Role Room Agent alongside the
   *  research bootstrap flow. */
  currentUserId?: string;
  initialWebsiteUrl?: string | null;
  initialOrganizationNumber?: string | null;
  initialCompanyName?: string | null;
  initialExtraContext?: string | null;
  initialResult?: RoleRoomAgentProducerBootstrapResult | null;
  access?: RoleRoomAgentAccess | null;
  generating?: boolean;
  applying?: boolean;
  error?: string | null;
  notice?: string | null;
  onGenerate: (input: {
    projectId: string;
    projectName: string;
    websiteUrl: string;
    organizationNumber: string;
    companyName: string;
    extraContext: string;
  }) => Promise<void> | void;
  onApply: (result: RoleRoomAgentProducerBootstrapResult) => Promise<void> | void;
  onCreateProject?: (result: RoleRoomAgentProducerBootstrapResult) => Promise<void> | void;
  /** Live progress (#2) — pass through from the parent's useResearchProgress
   *  hook. When status === 'streaming' the dialog renders the per-stage
   *  ticking timeline above the existing form. Optional so callers that
   *  haven't migrated to the SSE flow can omit them. */
  progressStages?: ResearchStage[];
  progressStatus?: ResearchProgressStatus;
  progressError?: string | null;
  /** Hvilken fane som er aktiv ved åpning. Default 'research'. Brukes
   *  når dialog-en åpnes fra et annet sted (f.eks. "Endre plan"-knappen
   *  i Markedsplan-arbeidsflaten) for å hoppe rett til riktig fane. */
  initialTab?: 'research' | 'marketing-plan' | 'merch' | 'feed-planner' | 'chat';
};

function renderList(items: string[]) {
  if (items.length === 0) {
    return (
      <Typography sx={{ color: 'rgba(226,232,240,0.68)', fontSize: '0.88rem' }}>
        Ingen forslag ennå.
      </Typography>
    );
  }

  return (
    <Stack component="ul" spacing={0.55} sx={{ pl: 2.2, m: 0 }}>
      {items.map((item) => (
        <Typography component="li" key={item} sx={{ color: 'rgba(226,232,240,0.88)', fontSize: '0.9rem', lineHeight: 1.55 }}>
          {item}
        </Typography>
      ))}
    </Stack>
  );
}

function renderClassificationChips(items: Array<string | null | undefined>) {
  const filtered = items.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  if (filtered.length === 0) {
    return null;
  }

  return (
    <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
      {filtered.map((item) => (
        <Chip
          key={item}
          label={item}
          size="small"
          variant="outlined"
          sx={{
            bgcolor: 'rgba(59,130,246,0.12)',
            color: '#dbeafe',
            borderColor: 'rgba(59,130,246,0.22)',
          }}
        />
      ))}
    </Stack>
  );
}

function formatNorwegianDate(value?: string | null) {
  if (!value) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' });
}

const SOCIAL_PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  x: 'X',
  threads: 'Threads',
  vimeo: 'Vimeo',
  pinterest: 'Pinterest',
};

// Bootstrap-detekteringen bruker korte plattform-koder ('facebook', 'x'),
// mens access-request-endepunktet bruker normaliserte publisher-koder
// ('facebook_page'). Vimeo har ingen tilgangs-flow ennå (egen invitasjon
// per video), så vi maper den til null og skjuler CTA-en.
function toAccessRequestPlatform(
  platform: string,
):
  | 'youtube'
  | 'instagram'
  | 'facebook_page'
  | 'linkedin'
  | 'tiktok'
  | 'x'
  | 'threads'
  | 'pinterest'
  | null {
  switch (platform) {
    case 'youtube':
    case 'instagram':
    case 'linkedin':
    case 'tiktok':
    case 'x':
    case 'threads':
    case 'pinterest':
      return platform;
    case 'facebook':
      return 'facebook_page';
    default:
      return null;
  }
}

const LOCAL_OPPORTUNITY_LABELS: Record<string, string> = {
  school: 'Skole',
  sports_club: 'Idrettslag',
  workplace: 'Arbeidsplass',
  hotel: 'Hotell',
  culture: 'Kulturarena',
  retail: 'Handel',
  fitness: 'Trening',
  community: 'Nærmiljø',
  venue: 'Venue',
  tourism: 'Turisme',
};

export default function RoleRoomAgentDialog({
  open,
  onClose,
  projectId,
  projectName,
  currentUserId,
  initialWebsiteUrl,
  initialOrganizationNumber,
  initialCompanyName,
  initialExtraContext,
  initialResult,
  access,
  generating = false,
  applying = false,
  error,
  notice,
  onGenerate,
  onApply,
  onCreateProject,
  progressStages,
  progressStatus,
  progressError,
  initialTab,
}: RoleRoomAgentDialogProps) {
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl ?? '');
  const [organizationNumber, setOrganizationNumber] = useState(initialOrganizationNumber ?? '');
  const [companyName, setCompanyName] = useState(initialCompanyName ?? '');
  const [extraContext, setExtraContext] = useState(initialExtraContext ?? '');

  // Refinement history — grows as the user tells the agent "actually...".
  // Each round is appended to the outgoing extraContext so Claude sees the
  // full correction trail as the newest source of truth.
  const [refinementDraft, setRefinementDraft] = useState('');
  const [refinementHistory, setRefinementHistory] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'research' | 'chat' | 'merch' | 'feed-planner' | 'marketing-plan' | 'meta-page' | 'page-content' | 'ads-attribution' | 'fb-publish' | 'fb-mention' | 'ig-hashtag' | 'social-inbox' | 'social-analytics'>(initialTab ?? 'research');

  // Synk hvis initialTab endrer seg etter mount (dialog gjenåpnes med
  // ny tab fra parent).
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);
  const [systemStatusOpen, setSystemStatusOpen] = useState(false);

  // Item #155 — lytt etter cross-component navigasjon (MarketingPlanPanel
  // sin "Send til feed-planner"-knapp dispatcher denne). Vi gjør det med
  // window event istedenfor prop-drilling fordi PostCard er dypt nestet
  // og prop-kjeden ville bli kontekst-spamming.
  useEffect(() => {
    const handler = (e: Event): void => {
      const detail = (e as CustomEvent).detail as { tab?: string } | null;
      if (detail?.tab === 'feed-planner') {
        setActiveTab('feed-planner');
      }
    };
    window.addEventListener('role-room:navigate-tab', handler);
    return () => window.removeEventListener('role-room:navigate-tab', handler);
  }, []);

  // Track whether the current generated result has already been turned
  // into a real project. Lets us (a) nudge the user while they're still
  // in the dialog and (b) confirm on close if they're about to lose
  // everything the agent produced. Reset whenever a new result arrives.
  // Track "saved" by the result OBJECT REFERENCE, not a boolean. A boolean got
  // reset every time the dialog re-opened (the [initialResult, open] effect),
  // so the banner re-nagged even after the user had saved. Keying on the result
  // ref means the saved state survives reopen and auto-clears only when a
  // genuinely new analysis (new object) arrives.
  // "Bruk forslag" applies the result INTO the current project (brief, branding,
  // story logic) — that IS saving.
  const [createdResultRef, setCreatedResultRef] =
    useState<RoleRoomAgentProducerBootstrapResult | null>(null);
  const [appliedResultRef, setAppliedResultRef] =
    useState<RoleRoomAgentProducerBootstrapResult | null>(null);
  // Research output is grouped into sections to cut the long single scroll.
  // 'alle' (default) keeps the original full view; the others filter the cards
  // via CSS display (cards stay mounted — no remount/effect churn).
  const [researchSection, setResearchSection] =
    useState<'alle' | 'oversikt' | 'kanaler' | 'marked'>('alle');

  // Phone + iPad-portrait widths get a fullScreen dialog so the chat
  // surface and the research forms are actually usable without pinch-
  // zoom. md+ keeps the centered dialog look that matches the rest of
  // the admin dashboard.
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    if (!open) {
      return;
    }
    setWebsiteUrl(initialWebsiteUrl ?? '');
    setOrganizationNumber(initialOrganizationNumber ?? '');
    setCompanyName(initialCompanyName ?? '');
    setExtraContext(initialExtraContext ?? '');
    setRefinementDraft('');
    setRefinementHistory([]);
  }, [initialCompanyName, initialExtraContext, initialOrganizationNumber, initialWebsiteUrl, open]);

  // No reset effect needed: saved-state is derived by comparing the saved
  // result reference to the current one (below), so a new analysis (new object)
  // automatically counts as unsaved, while a reopen of the same result stays
  // saved.

  // Compose the extraContext that actually gets sent to the agent. Original
  // extraContext is preserved verbatim; refinements are appended as a
  // clearly-labelled block so Claude treats them as the newest signal.
  const buildRefinedExtraContext = (nextRounds: string[]): string => {
    const base = extraContext.trim();
    if (nextRounds.length === 0) return base;
    const rounds = nextRounds
      .map((feedback, index) => `Runde ${index + 1}: ${feedback.trim()}`)
      .join('\n');
    const refinementBlock = `\n\n[Forfining fra bruker — nyeste signal, overskriv tidligere antagelser om de er feil]\n${rounds}`;
    return base ? `${base}${refinementBlock}` : refinementBlock.trimStart();
  };

  const submitRefinement = () => {
    const draft = refinementDraft.trim();
    if (!draft) return;
    const nextHistory = [...refinementHistory, draft];
    setRefinementHistory(nextHistory);
    setRefinementDraft('');
    void onGenerate({
      projectId,
      projectName,
      websiteUrl,
      organizationNumber,
      companyName,
      extraContext: buildRefinedExtraContext(nextHistory),
    });
  };

  const result = initialResult ?? null;
  const showResearchSection = (s: 'oversikt' | 'kanaler' | 'marked'): boolean =>
    researchSection === 'alle' || researchSection === s;
  // Derived saved-state — survives reopen, clears only when a new result object arrives.
  const projectCreatedFromResult = !!result && createdResultRef === result;
  const resultAppliedToProject = !!result && appliedResultRef === result;
  const canGenerate = companyName.trim().length > 0 || websiteUrl.trim().length > 0 || organizationNumber.trim().length > 0;
  const providerLabel = useMemo(() => {
    if (!result) return null;
    if (result.provider === 'openai') return `OpenAI · ${result.model}`;
    if (result.provider === 'anthropic') return `Anthropic Claude · ${result.model}`;
    return 'Fallback-analyse';
  }, [result]);
  const runtimeLabel = useMemo(() => {
    if (!access?.provider) {
      return null;
    }
    if (access.providerConfigured) {
      return `${access.provider === 'openai' ? 'OpenAI' : access.provider} · ${access.defaultModel || 'modell ikke satt'}`;
    }
    return 'OpenAI ikke konfigurert';
  }, [access]);
  const storyClassification = useMemo(() => {
    const classification = result?.storyLogicDraft?.classification;
    if (!classification || typeof classification !== 'object' || Array.isArray(classification)) {
      return null;
    }
    return classification as Record<string, unknown>;
  }, [result]);
  const contentStoryLogic = useMemo(() => {
    const value = result?.storyLogicDraft?.contentStoryLogic;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }, [result]);
  const googleReviewsLabel = useMemo(() => {
    if (!result?.businessSignals?.rating || !result.businessSignals.userRatingCount) {
      return null;
    }
    return `${result.businessSignals.rating.toFixed(1)} stjerner · ${result.businessSignals.userRatingCount} anmeldelser`;
  }, [result]);
  const retrievalLabel = useMemo(() => {
    if (!result?.retrievalMeta) {
      return null;
    }
    const meta = result.retrievalMeta;
    return `${meta.websitePagesSelected}/${meta.websitePagesReviewed} sider · ${meta.reviewsSelected}/${meta.reviewsReviewed} reviews`;
  }, [result]);
  const brregCompany = result?.brregCompany ?? null;
  const brregVerified = brregCompany?.lookupStatus === 'verified';
  const brregStatusLabel = useMemo(() => {
    if (!brregCompany) return null;
    if (brregCompany.lookupStatus === 'verified') {
      return brregCompany.matchedBy === 'organization_number'
        ? 'Brreg verifisert på org.nr'
        : 'Brreg verifisert på navn';
    }
    if (brregCompany.lookupStatus === 'invalid') return 'Ugyldig org.nr';
    if (brregCompany.lookupStatus === 'not_found') return 'Ikke funnet i Brreg';
    if (brregCompany.lookupStatus === 'unavailable') return 'Brreg utilgjengelig';
    return null;
  }, [brregCompany]);
  const criticalAgreementCount = useMemo(
    () => (result?.agreementSuggestions ?? []).filter((entry) => entry.priority === 'critical').length,
    [result],
  );
  const agreementSuggestions = result?.agreementSuggestions ?? [];
  const socialProfileCandidates = result?.socialProfileCandidates ?? [];
  const [accessRequestPlatform, setAccessRequestPlatform] = useState<{
    platform: 'youtube' | 'instagram' | 'facebook_page' | 'linkedin' | 'tiktok' | 'x' | 'threads' | 'pinterest';
    label: string;
  } | null>(null);
  const usableSocialProfileCandidates = useMemo(
    () => socialProfileCandidates.filter((candidate) => candidate.status === 'verified' || candidate.status === 'likely'),
    [socialProfileCandidates],
  );
  const competitorAnalysis = result?.competitorAnalysis ?? null;
  const usableCompetitors = useMemo(
    () => (competitorAnalysis?.competitors ?? []).filter((candidate) => candidate.status === 'verified' || candidate.status === 'likely'),
    [competitorAnalysis],
  );
  const competitorSummaryLabel = useMemo(() => {
    if (!competitorAnalysis) {
      return null;
    }
    const rating = typeof competitorAnalysis.averageRating === 'number'
      ? `${competitorAnalysis.averageRating.toFixed(1)} snitt-rating`
      : null;
    const reviews = typeof competitorAnalysis.averageReviewCount === 'number'
      ? `${competitorAnalysis.averageReviewCount} snitt-anmeldelser`
      : null;
    return [rating, reviews].filter(Boolean).join(' · ') || null;
  }, [competitorAnalysis]);
  const localPresencePlan = result?.localPresencePlan ?? null;
  const usableLocalOpportunities = useMemo(
    () => (localPresencePlan?.nearbyOpportunities ?? []).filter((opportunity) => opportunity.status === 'verified' || opportunity.status === 'likely'),
    [localPresencePlan],
  );

  // Close-guard: if the agent has produced a result that the user has
  // not yet turned into a real project, a refresh or close wipes it.
  // Ask before letting them throw it away.
  // Work is "saved" once it's either applied into THIS project ("Bruk forslag")
  // or turned into a NEW project ("Opprett prosjekt"). Either clears the nag.
  const agentWorkSaved = projectCreatedFromResult || resultAppliedToProject;
  const hasUnsavedAgentWork = Boolean(result && !agentWorkSaved);
  const handleCloseWithGuard = () => {
    if (hasUnsavedAgentWork) {
      const ok = typeof window !== 'undefined'
        ? window.confirm(
            'Du har generert forslag fra The Role Room Agent som ikke er lagret. ' +
            'Lagre med «Bruk forslag» (inn i dette prosjektet) eller «Opprett prosjekt» (ny kunde) først — ' +
            'lukker du nå, mister du analysen ved neste refresh. Vil du fortsette?',
          )
        : true;
      if (!ok) return;
    }
    onClose();
  };
  const handleCreateProjectAndMark = async () => {
    if (!result || !onCreateProject) return;
    try {
      await onCreateProject(result);
      setCreatedResultRef(result);
    } catch {
      // parent owns error UX (toast, notice prop); just leave the banner
      // visible so the user knows they still haven't saved.
    }
  };
  const handleApplyAndMark = async () => {
    if (!result) return;
    try {
      await onApply(result);
      setAppliedResultRef(result);
    } catch {
      // parent owns error UX; leave banner visible so user knows it didn't save.
    }
  };

  return (
    <Dialog
      open={open}
      onClose={generating || applying ? undefined : handleCloseWithGuard}
      fullWidth
      fullScreen={fullScreen}
      maxWidth="lg"
      PaperProps={{
        sx: {
          borderRadius: fullScreen ? 0 : 4,
          overflow: 'hidden',
          border: fullScreen ? 'none' : '1px solid rgba(34,211,238,0.22)',
          background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(2,6,23,0.98) 100%)',
          boxShadow: fullScreen ? 'none' : '0 32px 90px rgba(0,0,0,0.48)',
          // On iPad+iPhone let the whole panel scroll within viewport;
          // Dialog's default overflow:hidden leaves DialogContent as the
          // only scroll surface, which hides the composer behind the
          // keyboard. Using a max-height with internal flex-column makes
          // the composer stick naturally.
          display: 'flex',
          flexDirection: 'column',
          height: fullScreen ? '100%' : undefined,
          maxHeight: fullScreen ? '100%' : '92vh',
        },
      }}
    >
      {(generating || applying) ? <LinearProgress sx={{ height: 3 }} /> : null}
      <DialogTitle
        sx={{
          pb: 1.2,
          px: { xs: 1.4, md: 3 },
          pt: { xs: 1.4, md: 2 },
          borderBottom: '1px solid rgba(148,163,184,0.14)',
          background: 'radial-gradient(circle at top left, rgba(34,211,238,0.18) 0%, rgba(15,23,42,0) 48%)',
        }}
      >
        <Stack spacing={{ xs: 0.8, md: 1.1 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={{ xs: 1, md: 1 }}
            alignItems={{ xs: 'stretch', md: 'center' }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
              <Box
                sx={{
                  width: { xs: 38, md: 46 },
                  height: { xs: 38, md: 46 },
                  borderRadius: 2.5,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#22d3ee',
                  border: '1px solid rgba(34,211,238,0.26)',
                  bgcolor: 'rgba(8,47,73,0.22)',
                  boxShadow: '0 0 28px rgba(34,211,238,0.12)',
                  flexShrink: 0,
                }}
              >
                <AutoFixHighIcon sx={{ fontSize: { xs: 20, md: 24 } }} />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  sx={{
                    color: '#f8fafc',
                    fontWeight: 800,
                    fontSize: { xs: '1.05rem', md: '1.4rem' },
                    lineHeight: 1.2,
                  }}
                >
                  The Role Room Agent
                </Typography>
                <Typography
                  sx={{
                    color: 'rgba(226,232,240,0.72)',
                    fontSize: { xs: '0.78rem', md: '0.88rem' },
                    display: { xs: 'none', sm: 'block' },
                  }}
                >
                  Admin-test for kundeprofil, brief, branding og story logikk i innholdsprodusent-flyt.
                </Typography>
              </Box>
            </Stack>
            <Stack
              direction="row"
              spacing={0.8}
              flexWrap="wrap"
              useFlexGap
              alignItems="center"
              sx={{ rowGap: 0.6 }}
            >
              <Tooltip title="Denne testflaten er kun synlig for admin-brukere" disableInteractive>
                <Chip label="Kun admin" size="small" aria-label="Tilgang: kun admin" sx={{ bgcolor: 'rgba(15,118,110,0.18)', color: '#99f6e4' }} />
              </Tooltip>
              <Tooltip title="Rollen agenten kjører som: innholdsprodusent-flyt" disableInteractive>
                <Chip
                  label="Innholdsprodusent"
                  size="small"
                  aria-label="Rolle: innholdsprodusent"
                  sx={{ bgcolor: 'rgba(168,85,247,0.18)', color: '#f0abfc', display: { xs: 'none', sm: 'inline-flex' } }}
                />
              </Tooltip>
              <Tooltip title={`Aktivt prosjekt: ${projectName}`} disableInteractive>
                <Chip
                  label={projectName}
                  size="small"
                  aria-label={`Aktivt prosjekt: ${projectName}`}
                  sx={{
                    bgcolor: 'rgba(59,130,246,0.16)',
                    color: '#bfdbfe',
                    maxWidth: { xs: 160, md: 240 },
                    '& .MuiChip-label': { textOverflow: 'ellipsis', overflow: 'hidden' },
                  }}
                />
              </Tooltip>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setSystemStatusOpen(true)}
                sx={{
                  textTransform: 'none',
                  borderColor: 'rgba(148,163,184,0.3)',
                  color: '#cbd5e1',
                  fontSize: '0.72rem',
                  py: 0.2,
                  '&:hover': { borderColor: '#22d3ee', color: '#22d3ee' },
                }}
              >
                System status
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </DialogTitle>
      <RoleRoomAgentWorkflowStepper
        activeTab={activeTab}
        onJump={(firstTab) => setActiveTab(firstTab as typeof activeTab)}
      />
      <RoleRoomAgentConnectionsBar
        projectId={projectId}
        onConnectInstagram={async () => {
          const result = await roleRoomAgentService.startInstagramOauth(projectId);
          if ('url' in result) {
            window.open(result.url, '_blank', 'width=600,height=720,noopener');
          }
        }}
      />
      <Tabs
        value={activeTab}
        onChange={(_, next) => setActiveTab(next as typeof activeTab)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{
          px: { xs: 1, md: 2 },
          borderBottom: '1px solid rgba(148,163,184,0.14)',
          minHeight: { xs: 42, md: 48 },
          '& .MuiTab-root': {
            color: 'rgba(226,232,240,0.72)',
            textTransform: 'none',
            fontWeight: 600,
            minHeight: { xs: 42, md: 48 },
            minWidth: { xs: 'auto', md: 90 },
            px: { xs: 1.25, md: 2 },
            fontSize: { xs: '0.78rem', md: '0.875rem' },
          },
          '& .Mui-selected': { color: '#22d3ee !important' },
          '& .MuiTabs-indicator': { bgcolor: '#22d3ee' },
          '& .MuiTabs-scrollButtons': {
            color: 'rgba(226,232,240,0.72)',
            '&.Mui-disabled': { opacity: 0.3 },
          },
        }}
      >
        <Tab value="research" label="Research" icon={<AutoFixHighIcon fontSize="small" />} iconPosition="start" />
        <Tab
          value="merch"
          label="Merch"
          icon={<MerchIcon fontSize="small" />}
          iconPosition="start"
        />
        <Tab
          value="marketing-plan"
          label="Markedsplan"
          icon={<RocketIcon fontSize="small" />}
          iconPosition="start"
        />
        <Tab
          value="feed-planner"
          label="Feed-planner"
          icon={<GridViewIcon fontSize="small" />}
          iconPosition="start"
        />
        <Tab
          value="meta-page"
          label="Meta Page"
          icon={<FactCheckIcon fontSize="small" />}
          iconPosition="start"
        />
        <Tab
          value="page-content"
          label="Page Content"
          icon={<ArticleIcon fontSize="small" />}
          iconPosition="start"
        />
        <Tab
          value="ads-attribution"
          label="Ads Attribution"
          icon={<QueryStatsIcon fontSize="small" />}
          iconPosition="start"
        />
        <Tab
          value="fb-publish"
          label="FB Publish"
          icon={<CloudUploadIcon fontSize="small" />}
          iconPosition="start"
        />
        <Tab
          value="fb-mention"
          label="Page Mentions"
          icon={<AlternateEmailIcon fontSize="small" />}
          iconPosition="start"
        />
        <Tab
          value="ig-hashtag"
          label="IG Hashtags"
          icon={<TagIcon fontSize="small" />}
          iconPosition="start"
        />
        <Tab
          value="social-inbox"
          label="Inbox"
          icon={<InboxIcon fontSize="small" />}
          iconPosition="start"
          data-testid="agent-tab-social-inbox"
        />
        <Tab
          value="social-analytics"
          label="Analytics"
          icon={<QueryStatsIcon fontSize="small" />}
          iconPosition="start"
          data-testid="agent-tab-social-analytics"
        />
        {currentUserId ? (
          <Tab value="chat" label="Chat" icon={<ChatIcon fontSize="small" />} iconPosition="start" />
        ) : null}
      </Tabs>
      {hasUnsavedAgentWork ? (
        <Alert
          severity="warning"
          variant="outlined"
          sx={{
            mx: { xs: 1.4, md: 2 },
            mt: 1,
            mb: 0.4,
            borderColor: 'rgba(251,191,36,0.45)',
            color: '#fde68a',
            backgroundColor: 'rgba(120,53,15,0.22)',
            '& .MuiAlert-icon': { color: '#fcd34d' },
            fontSize: '0.84rem',
          }}
          action={
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="contained"
                onClick={handleApplyAndMark}
                disabled={generating || applying}
                sx={{
                  textTransform: 'none',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)',
                }}
              >
                {applying ? 'Lagrer…' : 'Bruk forslag (lagre her)'}
              </Button>
              {onCreateProject ? (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleCreateProjectAndMark}
                  disabled={generating || applying}
                  sx={{ textTransform: 'none', fontWeight: 700, color: '#fcd34d', borderColor: 'rgba(251,191,36,0.5)' }}
                >
                  Opprett nytt prosjekt
                </Button>
              ) : null}
            </Stack>
          }
        >
          Forslag fra The Role Room Agent er ikke lagret ennå. <strong>Bruk forslag</strong> lagrer
          dem i <strong>dette prosjektet</strong>; <strong>Opprett nytt prosjekt</strong> lager et
          for en ny kunde. Lukker du uten å lagre, mister du analysen ved neste refresh.
        </Alert>
      ) : agentWorkSaved ? (
        <Alert
          severity="success"
          variant="outlined"
          sx={{
            mx: { xs: 1.4, md: 2 },
            mt: 1,
            mb: 0.4,
            borderColor: 'rgba(34,197,94,0.4)',
            color: '#bbf7d0',
            backgroundColor: 'rgba(20,83,45,0.22)',
            '& .MuiAlert-icon': { color: '#86efac' },
            fontSize: '0.84rem',
          }}
        >
          {projectCreatedFromResult
            ? 'Prosjekt opprettet og lagret.'
            : 'Forslagene er lagret i prosjektet.'}
        </Alert>
      ) : null}
      <DialogContent
        sx={{
          p: activeTab === 'chat' ? 0 : { xs: 1.4, md: 2 },
          flex: 1,
          // Chat tab owns its own scroll region via the panel's internal
          // layout; research/feed-planner keep the dialog's default
          // overflow behaviour so their many cards scroll naturally.
          overflow: activeTab === 'chat' ? 'hidden' : 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Live progress (#2) — only the research tab benefits from this;
            other tabs (merch, feed-planner, etc.) consume the finished
            result. We render above the tab content so the user sees
            stages tick off without the form jumping around. */}
        {activeTab === 'research'
          && progressStatus
          && progressStatus !== 'idle'
          && (progressStatus === 'streaming' || (progressStages && progressStages.length > 0)) ? (
            <Box sx={{ px: { xs: 1.4, md: 2 }, pt: { xs: 1.4, md: 2 } }}>
              <ResearchProgressLive
                status={progressStatus}
                stages={progressStages ?? []}
                error={progressError ?? null}
              />
            </Box>
          ) : null}

        {activeTab === 'chat' && currentUserId ? (
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              // Transparent wrapper so the panel inherits the dark dialog
              // background — no more light band behind the chat that
              // made outlined chips and secondary text vanish.
              bgcolor: 'transparent',
            }}
          >
            <RoleRoomAgentChatPanel
              projectId={projectId}
              currentUserId={currentUserId}
              context={{
                briefSummary: initialExtraContext ?? undefined,
              }}
            />
          </Box>
        ) : activeTab === 'merch' ? (
          <Box sx={{ p: { xs: 1.4, md: 2 } }}>
            <MerchSuppliersPanel
              projectId={projectId}
              bootstrap={result}
              onRequestBootstrap={() => setActiveTab('research')}
            />
          </Box>
        ) : activeTab === 'feed-planner' ? (
          <RoleRoomFeedPlannerPanel
            projectId={projectId}
            bootstrap={result}
            onRequestBootstrap={() => setActiveTab('research')}
          />
        ) : activeTab === 'marketing-plan' ? (
          <Box sx={{ p: { xs: 1.4, md: 2 } }}>
            <MarketingPlanPanel projectId={projectId} bootstrap={result} />
          </Box>
        ) : activeTab === 'meta-page' ? (
          <Box sx={{ p: { xs: 1, md: 2 } }}>
            <MetaPagePublicMetadataInspector />
          </Box>
        ) : activeTab === 'page-content' ? (
          <Box sx={{ p: { xs: 1, md: 2 } }}>
            <PagePublicContentInspector />
          </Box>
        ) : activeTab === 'ads-attribution' ? (
          <Box sx={{ p: { xs: 1, md: 2 } }}>
            <AdsAttributionInspector />
          </Box>
        ) : activeTab === 'fb-publish' ? (
          <Box sx={{ p: { xs: 1, md: 2 } }}>
            <FacebookVideoPublisher />
          </Box>
        ) : activeTab === 'fb-mention' ? (
          <Box sx={{ p: { xs: 1, md: 2 } }}>
            <FacebookPageMentionPublisher />
          </Box>
        ) : activeTab === 'ig-hashtag' ? (
          <Box sx={{ p: { xs: 1, md: 2 } }}>
            <IgHashtagInspector />
          </Box>
        ) : activeTab === 'social-inbox' ? (
          <Box sx={{ p: { xs: 1, md: 2 } }}>
            <SocialInboxPanel />
          </Box>
        ) : activeTab === 'social-analytics' ? (
          <Box sx={{ p: { xs: 1, md: 2 } }}>
            <SocialAnalyticsPanel />
          </Box>
        ) : (
        <Stack spacing={1.4}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {notice ? <Alert severity="success">{notice}</Alert> : null}

          <Stack direction="row" justifyContent="flex-end">
            <ResearchVersionsPickerInline projectId={projectId} />
          </Stack>


          <Box
            sx={{
              p: 1.2,
              borderRadius: 3,
              border: '1px solid rgba(34,211,238,0.12)',
              bgcolor: 'rgba(15,23,42,0.52)',
            }}
          >
            <Stack spacing={1.1}>
              <Typography sx={{ color: '#e2e8f0', fontWeight: 700 }}>
                Start med kundesignaler
              </Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.1}>
                <TextField
                  label="Nettside"
                  value={websiteUrl}
                  onChange={(event) => setWebsiteUrl(event.target.value)}
                  fullWidth
                  placeholder="https://kunde.no"
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="Org.nr"
                  value={organizationNumber}
                  onChange={(event) => setOrganizationNumber(event.target.value)}
                  fullWidth
                  placeholder="999 999 999"
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>
              <TextField
                label="Firmanavn"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                fullWidth
                placeholder="Northwind Drilling"
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Ekstra kontekst"
                value={extraContext}
                onChange={(event) => setExtraContext(event.target.value)}
                fullWidth
                multiline
                minRows={3}
                placeholder="Legg inn kampanjemål, målgruppe, leveranser eller annet du vil at agenten skal ta hensyn til."
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
          </Box>

          {result ? (
            <Stack spacing={1.2}>
              <Alert severity={brregVerified ? 'success' : 'info'}>
                {brregVerified
                  ? `Vi har nå hentet all tilgjengelig offentlig informasjon om kunden fra Brønnøysundregistrene. Ønsker du å opprette et prosjekt på ${result.companyProfile.companyName}?`
                  : brregCompany?.statusMessage || 'Agenten har laget et kundeutkast. Brreg-data er ikke verifisert for denne analysen.'}
              </Alert>

              {/* Multi-turn refinement: user tells the agent "actually X" and
                  we re-run the pipeline with the feedback appended to
                  extraContext. History is shown as chips so the user can
                  track their own corrections. */}
              <Box
                sx={{
                  p: 1.2,
                  borderRadius: 3,
                  border: '1px dashed rgba(34,211,238,0.28)',
                  bgcolor: 'rgba(8,47,73,0.32)',
                }}
              >
                <Stack spacing={0.85}>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.92rem' }}>
                    Forfin utkastet
                  </Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                    Ikke helt treff? Fortell agenten hva som er feil, så genererer den på nytt
                    med den korreksjonen som nyeste signal. Eksempler: «Vi er B2B, ikke B2C»,
                    «Fjern fokus på lokalt event», «Tone of voice skal være humoristisk».
                  </Typography>
                  {refinementHistory.length > 0 ? (
                    <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                      {refinementHistory.map((entry, index) => (
                        <Chip
                          key={`rr-refinement-${index}`}
                          label={`Runde ${index + 1}: ${entry.length > 60 ? `${entry.slice(0, 60)}…` : entry}`}
                          size="small"
                          sx={{ bgcolor: 'rgba(34,211,238,0.14)', color: '#a5f3fc', maxWidth: '100%' }}
                        />
                      ))}
                    </Stack>
                  ) : null}
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'flex-end' }}>
                    <TextField
                      value={refinementDraft}
                      onChange={(event) => setRefinementDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                          event.preventDefault();
                          submitRefinement();
                        }
                      }}
                      placeholder="Hva bør agenten endre i utkastet?"
                      size="small"
                      multiline
                      minRows={2}
                      fullWidth
                      disabled={generating || applying}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'rgba(15,23,42,0.48)',
                          color: '#f1f5f9',
                        },
                      }}
                    />
                    <Button
                      variant="contained"
                      disabled={!refinementDraft.trim() || generating || applying}
                      onClick={submitRefinement}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        minHeight: 40,
                        bgcolor: 'rgba(34,211,238,0.9)',
                        color: '#082f49',
                        '&:hover': { bgcolor: 'rgba(34,211,238,1)' },
                      }}
                    >
                      {generating ? 'Forfiner…' : 'Forfin'}
                    </Button>
                  </Stack>
                </Stack>
              </Box>
              {/* Summary-first: lead with what we found + top recommendations,
                  so the producer isn't dropped straight into a wall of cards. */}
              <Box
                data-testid="research-summary"
                sx={{
                  p: 1.4,
                  borderRadius: 3,
                  border: '1px solid rgba(34,211,238,0.3)',
                  bgcolor: 'rgba(34,211,238,0.06)',
                }}
              >
                <Typography
                  sx={{
                    color: '#22d3ee',
                    fontWeight: 800,
                    fontSize: '0.74rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    mb: 0.6,
                  }}
                >
                  Sammendrag
                </Typography>
                <Typography sx={{ color: '#e2e8f0', lineHeight: 1.6 }}>
                  {result.companyProfile.summary}
                </Typography>
                <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                  {result.companyProfile.industry ? (
                    <Chip size="small" label={result.companyProfile.industry} sx={{ bgcolor: 'rgba(148,163,184,0.16)', color: '#e2e8f0' }} />
                  ) : null}
                  {result.companyAge?.label ? (
                    <Chip size="small" label={result.companyAge.label} sx={{ bgcolor: 'rgba(16,185,129,0.16)', color: '#bbf7d0' }} />
                  ) : null}
                  {socialProfileCandidates.length > 0 ? (
                    <Chip size="small" label={`${socialProfileCandidates.length} sosiale kontoer`} sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }} />
                  ) : null}
                  {competitorAnalysis?.competitors?.length ? (
                    <Chip size="small" label={`${competitorAnalysis.competitors.length} konkurrenter`} sx={{ bgcolor: 'rgba(168,85,247,0.16)', color: '#f0abfc' }} />
                  ) : null}
                </Stack>
                {(() => {
                  const recs = (competitorAnalysis?.marketingOpportunities?.length
                    ? competitorAnalysis.marketingOpportunities
                    : localPresencePlan?.recommendedEventConcepts ?? []).slice(0, 3);
                  return recs.length > 0 ? (
                    <Box sx={{ mt: 1.2 }}>
                      <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontWeight: 700, fontSize: '0.72rem', mb: 0.4 }}>
                        Anbefalte neste steg
                      </Typography>
                      <Stack component="ol" spacing={0.4} sx={{ m: 0, pl: 2.2 }}>
                        {recs.map((r, i) => (
                          <Typography key={i} component="li" sx={{ color: '#e2e8f0', fontSize: '0.86rem', lineHeight: 1.5 }}>
                            {r}
                          </Typography>
                        ))}
                      </Stack>
                    </Box>
                  ) : null;
                })()}
              </Box>
              <Stack
                direction="row"
                spacing={0.8}
                flexWrap="wrap"
                useFlexGap
                role="tablist"
                aria-label="Research-seksjoner"
                sx={{ mb: 0.2 }}
              >
                {([
                  ['alle', 'Alle'],
                  ['oversikt', 'Oversikt'],
                  ['kanaler', 'Kanaler'],
                  ['marked', 'Marked'],
                ] as const).map(([key, label]) => {
                  const selected = researchSection === key;
                  return (
                    <Chip
                      key={key}
                      label={label}
                      size="small"
                      clickable
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setResearchSection(key)}
                      data-testid={`research-section-${key}`}
                      sx={{
                        fontWeight: 700,
                        bgcolor: selected ? 'rgba(34,211,238,0.18)' : 'rgba(148,163,184,0.12)',
                        color: selected ? '#22d3ee' : 'rgba(226,232,240,0.7)',
                        border: selected ? '1px solid rgba(34,211,238,0.5)' : '1px solid transparent',
                      }}
                    />
                  );
                })}
              </Stack>
              <Stack
                direction={{ xs: 'column', lg: 'row' }}
                spacing={1.2}
                sx={{ display: showResearchSection('oversikt') ? undefined : 'none' }}
              >
                <Box
                  sx={{
                    flex: 1.25,
                    p: 1.25,
                    borderRadius: 3,
                    border: '1px solid rgba(56,189,248,0.16)',
                    bgcolor: 'rgba(15,23,42,0.48)',
                  }}
                >
                  <Stack spacing={0.9}>
                    <Stack direction="row" spacing={0.9} alignItems="center" justifyContent="space-between">
                      <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>Kundeprofil</Typography>
                      <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap justifyContent="flex-end">
                        {providerLabel ? (
                          <Chip label={providerLabel} size="small" sx={{ bgcolor: 'rgba(34,211,238,0.12)', color: '#a5f3fc' }} />
                        ) : null}
                        {retrievalLabel ? (
                          <Chip label={retrievalLabel} size="small" sx={{ bgcolor: 'rgba(16,185,129,0.12)', color: '#a7f3d0' }} />
                        ) : null}
                      </Stack>
                    </Stack>
                    <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1.02rem' }}>
                      {result.companyProfile.companyName}
                    </Typography>
                    <Typography sx={{ color: 'rgba(226,232,240,0.84)', lineHeight: 1.65 }}>
                      {result.companyProfile.summary}
                    </Typography>
                    <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                      {result.companyProfile.websiteUrl ? (
                        <Chip icon={<LanguageIcon sx={{ fontSize: '1rem !important' }} />} label={result.companyProfile.websiteUrl} size="small" />
                      ) : null}
                      {result.companyProfile.organizationNumber ? (
                        <Chip label={`Org.nr ${result.companyProfile.organizationNumber}`} size="small" />
                      ) : null}
                      {brregStatusLabel ? (
                        <Chip label={brregStatusLabel} size="small" sx={{ bgcolor: brregVerified ? 'rgba(16,185,129,0.14)' : 'rgba(250,204,21,0.14)', color: brregVerified ? '#a7f3d0' : '#fde68a' }} />
                      ) : null}
                    </Stack>
                    {renderClassificationChips([
                      `Bransje: ${result.companyProfile.industry}`,
                      `Underbransje: ${result.companyProfile.subIndustry}`,
                      `Modell: ${result.companyProfile.businessModel}`,
                    ])}
                    <Divider sx={{ borderColor: 'rgba(148,163,184,0.12)' }} />
                    <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.84rem', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                      Tilbud og målgruppe
                    </Typography>
                    {renderList([...result.companyProfile.offerings, ...result.companyProfile.targetAudience.map((entry) => `Målgruppe: ${entry}`)])}
                  </Stack>
                </Box>

                <Box
                  sx={{
                    flex: 1,
                    p: 1.25,
                    borderRadius: 3,
                    border: '1px solid rgba(244,114,182,0.18)',
                    bgcolor: 'rgba(30,41,59,0.5)',
                  }}
                >
                  <Stack spacing={0.9}>
                    <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>Branding og brief</Typography>
                    <Typography sx={{ color: 'rgba(226,232,240,0.84)', lineHeight: 1.6 }}>
                      {result.intakeDraft.keyMessage}
                    </Typography>
                    <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.84rem', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                      Tone og brand-signaler
                    </Typography>
                    {renderList(result.companyProfile.toneAndBrandSignals)}
                    {renderClassificationChips([
                      `Innholdskategori: ${result.companyProfile.contentCategory}`,
                      `Produksjonsgrep: ${result.companyProfile.productionApproach}`,
                    ])}
                    {result.planningDraft.brandGuide.logoUrl ? (
                      <Typography sx={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                        Logo funnet: {result.planningDraft.brandGuide.logoUrl}
                      </Typography>
                    ) : null}
                  </Stack>
                </Box>
              </Stack>

              {brregCompany || result.companyAge || agreementSuggestions.length > 0 ? (
                <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.2}>
                  <Box
                    sx={{
                      flex: 1,
                      p: 1.2,
                      borderRadius: 3,
                      border: '1px solid rgba(16,185,129,0.18)',
                      bgcolor: 'rgba(6,78,59,0.14)',
                    }}
                  >
                    <Stack spacing={0.85}>
                      <Stack direction="row" spacing={0.8} alignItems="center" justifyContent="space-between">
                        <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>Brreg og selskapsstatus</Typography>
                        {result.companyAge?.label ? (
                          <Chip size="small" label={result.companyAge.label} sx={{ bgcolor: 'rgba(16,185,129,0.16)', color: '#bbf7d0' }} />
                        ) : null}
                      </Stack>
                      {renderClassificationChips([
                        brregCompany?.organizationForm?.description ? `Form: ${brregCompany.organizationForm.description}` : null,
                        brregCompany?.industryCode?.description ? `Næring: ${brregCompany.industryCode.description}` : null,
                        brregCompany?.vatRegistered === true ? 'MVA-registrert' : brregCompany?.vatRegistered === false ? 'Ikke MVA-registrert' : null,
                        typeof brregCompany?.employeeCount === 'number' ? `${brregCompany.employeeCount} ansatte` : null,
                        brregCompany?.registrationDate ? `Registrert: ${formatNorwegianDate(brregCompany.registrationDate)}` : null,
                      ])}
                      {brregCompany?.businessAddress ? (
                        <Typography sx={{ color: 'rgba(226,232,240,0.82)', fontSize: '0.9rem' }}>
                          Adresse: {brregCompany.businessAddress}
                        </Typography>
                      ) : null}
                      {brregCompany?.statusFlags && Object.values(brregCompany.statusFlags).some(Boolean) ? (
                        <Alert severity="warning">
                          Brreg viser statusflagg på kunden. Kontroller dette manuelt før avtale sendes.
                        </Alert>
                      ) : null}
                    </Stack>
                  </Box>

                  <Box
                    sx={{
                      flex: 1,
                      p: 1.2,
                      borderRadius: 3,
                      border: criticalAgreementCount > 0 ? '1px solid rgba(248,113,113,0.32)' : '1px solid rgba(250,204,21,0.18)',
                      bgcolor: criticalAgreementCount > 0 ? 'rgba(127,29,29,0.2)' : 'rgba(71,36,0,0.18)',
                    }}
                  >
                    <Stack spacing={0.85}>
                      <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>Avtaleforslag</Typography>
                      {agreementSuggestions.length > 0 ? (
                        <Stack spacing={0.8}>
                          {agreementSuggestions.map((suggestion) => (
                            <Box key={suggestion.id} sx={{ p: 0.9, borderRadius: 2.2, bgcolor: 'rgba(15,23,42,0.42)', border: '1px solid rgba(148,163,184,0.12)' }}>
                              <Stack direction="row" spacing={0.7} alignItems="center" sx={{ mb: 0.4 }}>
                                <Chip
                                  size="small"
                                  label={suggestion.priority === 'critical' ? 'Kritisk' : suggestion.priority === 'recommended' ? 'Anbefalt' : 'Standard'}
                                  sx={{
                                    bgcolor: suggestion.priority === 'critical' ? 'rgba(248,113,113,0.18)' : suggestion.priority === 'recommended' ? 'rgba(250,204,21,0.16)' : 'rgba(59,130,246,0.14)',
                                    color: suggestion.priority === 'critical' ? '#fecaca' : suggestion.priority === 'recommended' ? '#fde68a' : '#bfdbfe',
                                  }}
                                />
                                <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.9rem' }}>{suggestion.title}</Typography>
                              </Stack>
                              <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '0.86rem', lineHeight: 1.55 }}>{suggestion.detail}</Typography>
                            </Box>
                          ))}
                        </Stack>
                      ) : (
                        <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.9rem' }}>
                          Ingen egne avtaleforslag for denne analysen.
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                </Stack>
              ) : null}

              {socialProfileCandidates.length > 0 ? (
                <Box
                  sx={{
                    display: showResearchSection('kanaler') ? undefined : 'none',
                    p: 1.2,
                    borderRadius: 3,
                    border: '1px solid rgba(59,130,246,0.2)',
                    bgcolor: 'rgba(15,23,42,0.46)',
                  }}
                >
                  <Stack spacing={1}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
                      <Box>
                        <Typography sx={{ color: '#f8fafc', fontWeight: 800 }}>Sosiale kontoer funnet</Typography>
                        <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.86rem' }}>
                          Kontoene er forslag basert på kundens nettside og strukturert data. Bekreft før publisering eller tilgangsforespørsel.
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={`${usableSocialProfileCandidates.length}/${socialProfileCandidates.length} klare for bruk`}
                        sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                      />
                    </Stack>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.9} flexWrap="wrap" useFlexGap>
                      {socialProfileCandidates.map((profile) => (
                        <Box
                          key={profile.canonicalUrl}
                          sx={{
                            flex: '1 1 220px',
                            minWidth: 0,
                            p: 1,
                            borderRadius: 2.4,
                            border: profile.status === 'verified'
                              ? '1px solid rgba(16,185,129,0.26)'
                              : '1px solid rgba(148,163,184,0.16)',
                            bgcolor: profile.status === 'verified' ? 'rgba(6,78,59,0.16)' : 'rgba(15,23,42,0.52)',
                          }}
                        >
                          <Stack spacing={0.7}>
                            <Stack direction="row" spacing={0.7} alignItems="center" justifyContent="space-between">
                              <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.92rem' }}>
                                {SOCIAL_PLATFORM_LABELS[profile.platform] || profile.platform}
                              </Typography>
                              <Chip
                                size="small"
                                label={`${profile.confidence}%`}
                                sx={{
                                  bgcolor: profile.status === 'verified' ? 'rgba(16,185,129,0.18)' : 'rgba(250,204,21,0.14)',
                                  color: profile.status === 'verified' ? '#bbf7d0' : '#fde68a',
                                }}
                              />
                            </Stack>
                            <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '0.84rem', wordBreak: 'break-word' }}>
                              {profile.handle ? `@${profile.handle}` : profile.displayName || profile.url}
                            </Typography>
                            {profile.evidence.length > 0 ? (
                              <Typography sx={{ color: 'rgba(226,232,240,0.62)', fontSize: '0.78rem', lineHeight: 1.45 }}>
                                {profile.evidence.slice(0, 2).map((entry) => entry.label).join(' · ')}
                              </Typography>
                            ) : null}
                            <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                              <Button
                                href={profile.url}
                                target="_blank"
                                rel="noreferrer"
                                size="small"
                                variant="outlined"
                                sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.74rem' }}
                              >
                                Åpne konto
                              </Button>
                              {(() => {
                                const accessPlatform = toAccessRequestPlatform(profile.platform);
                                if (!accessPlatform) return null;
                                return (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() =>
                                      setAccessRequestPlatform({
                                        platform: accessPlatform,
                                        label:
                                          SOCIAL_PLATFORM_LABELS[profile.platform] ||
                                          profile.platform,
                                      })
                                    }
                                    sx={{
                                      textTransform: 'none',
                                      fontWeight: 700,
                                      fontSize: '0.74rem',
                                      color: '#93c5fd',
                                      borderColor: 'rgba(59,130,246,0.4)',
                                    }}
                                  >
                                    Be kunden om tilgang
                                  </Button>
                                );
                              })()}
                            </Stack>
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  </Stack>
                </Box>
              ) : result ? (
                <Alert severity="info">
                  Ingen offisielle sosiale kontoer ble funnet på kundens nettside. Be kunden bekrefte riktige kanaler før de legges inn i prosjektet.
                </Alert>
              ) : null}

              {competitorAnalysis ? (
                <Box
                  sx={{
                    display: showResearchSection('marked') ? undefined : 'none',
                    p: 1.2,
                    borderRadius: 3,
                    border: competitorAnalysis.status === 'ready'
                      ? '1px solid rgba(34,197,94,0.22)'
                      : '1px solid rgba(250,204,21,0.2)',
                    bgcolor: competitorAnalysis.status === 'ready' ? 'rgba(6,78,59,0.14)' : 'rgba(71,36,0,0.16)',
                  }}
                >
                  <Stack spacing={1}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8} alignItems={{ md: 'center' }} justifyContent="space-between">
                      <Box>
                        <Typography sx={{ color: '#f8fafc', fontWeight: 800 }}>Konkurrentanalyse og markedsføring</Typography>
                        <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.86rem', lineHeight: 1.5 }}>
                          {competitorAnalysis.marketContext}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                        <Chip
                          size="small"
                          label={`${usableCompetitors.length}/${competitorAnalysis.competitors.length} klare for vurdering`}
                          sx={{ bgcolor: 'rgba(34,197,94,0.14)', color: '#bbf7d0' }}
                        />
                        {competitorSummaryLabel ? (
                          <Chip size="small" label={competitorSummaryLabel} sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }} />
                        ) : null}
                      </Stack>
                    </Stack>

                    {competitorAnalysis.competitors.length > 0 ? (
                      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={0.9} flexWrap="wrap" useFlexGap>
                        {competitorAnalysis.competitors.slice(0, 6).map((competitor) => (
                          <Box
                            key={competitor.placeId || competitor.name}
                            sx={{
                              flex: '1 1 250px',
                              minWidth: 0,
                              p: 1,
                              borderRadius: 2.4,
                              border: competitor.status === 'verified'
                                ? '1px solid rgba(16,185,129,0.26)'
                                : '1px solid rgba(148,163,184,0.16)',
                              bgcolor: 'rgba(15,23,42,0.48)',
                            }}
                          >
                            <Stack spacing={0.7}>
                              <Stack direction="row" spacing={0.7} alignItems="center" justifyContent="space-between">
                                <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.92rem' }}>
                                  {competitor.name}
                                </Typography>
                                <Chip
                                  size="small"
                                  // Semantic status pill instead of raw "67%". Confidence is
                                  // surfaced via the dotted tooltip for users who care.
                                  label={
                                    competitor.status === 'verified'
                                      ? 'Verifisert'
                                      : competitor.status === 'likely'
                                        ? 'Sannsynlig'
                                        : competitor.status === 'needs_review'
                                          ? 'Manuell sjekk'
                                          : 'Avvist'
                                  }
                                  title={`Konfidens: ${competitor.confidence}%`}
                                  sx={{
                                    bgcolor: competitor.status === 'verified'
                                      ? 'rgba(16,185,129,0.18)'
                                      : competitor.status === 'likely'
                                        ? 'rgba(59,130,246,0.16)'
                                        : 'rgba(250,204,21,0.14)',
                                    color: competitor.status === 'verified'
                                      ? '#bbf7d0'
                                      : competitor.status === 'likely'
                                        ? '#bfdbfe'
                                        : '#fde68a',
                                    fontWeight: 700,
                                  }}
                                />
                              </Stack>
                              {/* Single combined chip row: source + category + rating + reviews. */}
                              {renderClassificationChips([
                                (competitor as any).source === 'brreg_nace' && (competitor as any).naceCode
                                  ? `Brreg NACE ${(competitor as any).naceCode}`
                                  : (competitor as any).source === 'brreg_nace'
                                    ? 'Brreg-bekreftet'
                                    : null,
                                competitor.primaryTypeDisplayName,
                                typeof competitor.rating === 'number' && typeof competitor.userRatingCount === 'number'
                                  ? `★ ${competitor.rating.toFixed(1)} (${competitor.userRatingCount})`
                                  : typeof competitor.rating === 'number'
                                    ? `★ ${competitor.rating.toFixed(1)}`
                                    : null,
                              ])}
                              {/* Position hint reads as a complete short sentence — keep
                                  it as the headline reason. The raw scoring evidence used
                                  to render here too but duplicated rating/reviews already
                                  shown in the chips above, so it was removed. */}
                              <Typography sx={{ color: '#cbd5e1', fontSize: '0.82rem', lineHeight: 1.5 }}>
                                {competitor.marketingSignals.positionHint}
                              </Typography>
                              <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.76rem', lineHeight: 1.45 }}>
                                {competitor.relevanceReason}
                              </Typography>
                              {(competitor as any).metaPage ? (
                                <Box
                                  data-testid="competitor-meta-page"
                                  sx={{
                                    mt: 0.8,
                                    p: 0.9,
                                    borderRadius: 1.8,
                                    border: '1px solid rgba(59,130,246,0.28)',
                                    bgcolor: 'rgba(59,130,246,0.08)',
                                  }}
                                >
                                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.4 }}>
                                    <Typography sx={{ color: '#93c5fd', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                      Meta Page Public Metadata
                                    </Typography>
                                    {(competitor as any).metaPage.verified ? (
                                      <Chip size="small" label="Verified" sx={{ height: 16, fontSize: '0.62rem', bgcolor: 'rgba(29,161,242,0.22)', color: '#bfdbfe' }} />
                                    ) : null}
                                  </Stack>
                                  <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                                    {typeof (competitor as any).metaPage.followersCount === 'number' ? (
                                      <Chip size="small" label={`${((competitor as any).metaPage.followersCount as number).toLocaleString('nb-NO')} følgere`} sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }} />
                                    ) : null}
                                    {typeof (competitor as any).metaPage.fanCount === 'number' ? (
                                      <Chip size="small" label={`${((competitor as any).metaPage.fanCount as number).toLocaleString('nb-NO')} likes`} sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }} />
                                    ) : null}
                                    {(competitor as any).metaPage.category ? (
                                      <Chip size="small" label={(competitor as any).metaPage.category} variant="outlined" sx={{ color: '#cbd5e1', borderColor: 'rgba(148,163,184,0.3)' }} />
                                    ) : null}
                                  </Stack>
                                  {(competitor as any).metaPage.about ? (
                                    <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '0.78rem', lineHeight: 1.45, mt: 0.5 }}>
                                      {(competitor as any).metaPage.about}
                                    </Typography>
                                  ) : null}
                                </Box>
                              ) : null}
                              <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                                {competitor.websiteUrl ? (
                                  <Button href={competitor.websiteUrl} target="_blank" rel="noreferrer" size="small" variant="outlined" sx={{ textTransform: 'none', fontWeight: 700 }}>
                                    Nettside
                                  </Button>
                                ) : null}
                                {competitor.googleMapsUri ? (
                                  <Button href={competitor.googleMapsUri} target="_blank" rel="noreferrer" size="small" variant="outlined" sx={{ textTransform: 'none', fontWeight: 700 }}>
                                    Google
                                  </Button>
                                ) : null}
                                {(competitor as any).metaPage?.pageUrl ? (
                                  <Button
                                    href={(competitor as any).metaPage.pageUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    size="small"
                                    variant="outlined"
                                    sx={{ textTransform: 'none', fontWeight: 700, color: '#bfdbfe', borderColor: 'rgba(59,130,246,0.4)' }}
                                  >
                                    Meta Page
                                  </Button>
                                ) : null}
                              </Stack>
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    ) : (
                      <Alert severity="info">
                        Ingen verifiserbare konkurrenter ble funnet automatisk. Be kunden oppgi konkurrenter manuelt før markedsføringsvinkel låses.
                      </Alert>
                    )}

                    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1}>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.84rem', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.8 }}>
                          Muligheter
                        </Typography>
                        {renderList(competitorAnalysis.marketingOpportunities)}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.84rem', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.8 }}>
                          Posisjonering
                        </Typography>
                        {renderList(competitorAnalysis.positioningRecommendations)}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.84rem', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.8 }}>
                          Spør kunden
                        </Typography>
                        {renderList(competitorAnalysis.producerQuestions)}
                      </Box>
                    </Stack>
                    {competitorAnalysis.limitations.length > 0 ? (
                      <Typography sx={{ color: 'rgba(226,232,240,0.56)', fontSize: '0.78rem', lineHeight: 1.5 }}>
                        Begrensning: {competitorAnalysis.limitations[0]}
                      </Typography>
                    ) : null}
                  </Stack>
                </Box>
              ) : null}

              {localPresencePlan ? (
                <Box
                  sx={{
                    display: showResearchSection('marked') ? undefined : 'none',
                    p: 1.2,
                    borderRadius: 3,
                    border: localPresencePlan.status === 'ready'
                      ? '1px solid rgba(45,212,191,0.24)'
                      : '1px solid rgba(250,204,21,0.2)',
                    bgcolor: localPresencePlan.status === 'ready' ? 'rgba(15,118,110,0.14)' : 'rgba(71,36,0,0.16)',
                  }}
                >
                  <Stack spacing={1}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8} alignItems={{ md: 'center' }} justifyContent="space-between">
                      <Box>
                        <Typography sx={{ color: '#f8fafc', fontWeight: 800 }}>Lokal synlighet og event</Typography>
                        <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.86rem', lineHeight: 1.5 }}>
                          {localPresencePlan.industryContext} · {localPresencePlan.marketArea}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={`${usableLocalOpportunities.length}/${localPresencePlan.nearbyOpportunities.length} lokale muligheter`}
                        sx={{ bgcolor: 'rgba(45,212,191,0.16)', color: '#99f6e4' }}
                      />
                    </Stack>

                    {localPresencePlan.radiusStrategy.length > 0 ? (
                      <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                        {localPresencePlan.radiusStrategy.map((ring) => (
                          <Chip
                            key={`${ring.radiusKm}-${ring.label}`}
                            size="small"
                            label={`${ring.label}: ${ring.radiusKm} km`}
                            variant="outlined"
                            sx={{ color: '#ccfbf1', borderColor: 'rgba(45,212,191,0.24)' }}
                          />
                        ))}
                      </Stack>
                    ) : null}

                    {localPresencePlan.nearbyOpportunities.length > 0 ? (
                      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={0.9} flexWrap="wrap" useFlexGap>
                        {localPresencePlan.nearbyOpportunities.slice(0, 6).map((opportunity) => (
                          <Box
                            key={opportunity.placeId || `${opportunity.type}-${opportunity.name}`}
                            sx={{
                              flex: '1 1 260px',
                              minWidth: 0,
                              p: 1,
                              borderRadius: 2.4,
                              border: opportunity.status === 'verified'
                                ? '1px solid rgba(45,212,191,0.3)'
                                : '1px solid rgba(148,163,184,0.16)',
                              bgcolor: 'rgba(15,23,42,0.5)',
                            }}
                          >
                            <Stack spacing={0.7}>
                              <Stack direction="row" spacing={0.7} alignItems="center" justifyContent="space-between">
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.92rem' }}>
                                    {opportunity.name}
                                  </Typography>
                                  <Typography sx={{ color: 'rgba(226,232,240,0.62)', fontSize: '0.78rem' }}>
                                    {LOCAL_OPPORTUNITY_LABELS[opportunity.type] || opportunity.type} · {opportunity.radiusKm} km radius
                                  </Typography>
                                </Box>
                                <Chip
                                  size="small"
                                  label={`${opportunity.confidence}%`}
                                  sx={{
                                    bgcolor: opportunity.status === 'verified' ? 'rgba(45,212,191,0.18)' : 'rgba(250,204,21,0.14)',
                                    color: opportunity.status === 'verified' ? '#99f6e4' : '#fde68a',
                                  }}
                                />
                              </Stack>
                              <Typography sx={{ color: 'rgba(226,232,240,0.84)', fontSize: '0.84rem', lineHeight: 1.5 }}>
                                {opportunity.eventIdea}
                              </Typography>
                              <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.8rem', lineHeight: 1.45 }}>
                                Partnerverdi: {opportunity.partnerValue}
                              </Typography>
                              {renderClassificationChips([
                                opportunity.primaryTypeDisplayName ? `Kategori: ${opportunity.primaryTypeDisplayName}` : null,
                                typeof opportunity.rating === 'number' ? `${opportunity.rating.toFixed(1)} stjerner` : null,
                                opportunity.formattedAddress ? `Adresse: ${opportunity.formattedAddress}` : null,
                              ])}
                              <Typography sx={{ color: 'rgba(226,232,240,0.58)', fontSize: '0.76rem', lineHeight: 1.45 }}>
                                {opportunity.evidence.slice(0, 2).map((entry) => entry.label).join(' · ')}
                              </Typography>
                              <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                                {opportunity.websiteUrl ? (
                                  <Button href={opportunity.websiteUrl} target="_blank" rel="noreferrer" size="small" variant="outlined" sx={{ textTransform: 'none', fontWeight: 700 }}>
                                    Nettside
                                  </Button>
                                ) : null}
                                {opportunity.googleMapsUri ? (
                                  <Button href={opportunity.googleMapsUri} target="_blank" rel="noreferrer" size="small" variant="outlined" sx={{ textTransform: 'none', fontWeight: 700 }}>
                                    Kart
                                  </Button>
                                ) : null}
                              </Stack>
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    ) : (
                      <Alert severity="info">
                        Agenten har laget eventretninger, men fant ikke verifiserbare lokale steder automatisk. Bekreft adresse eller øk radius i manuell kartgjennomgang.
                      </Alert>
                    )}

                    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1}>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.84rem', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.8 }}>
                          Eventkonsepter
                        </Typography>
                        {renderList(localPresencePlan.recommendedEventConcepts.slice(0, 5))}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.84rem', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.8 }}>
                          Innholdsplan
                        </Typography>
                        {renderList(localPresencePlan.contentActivationPlan.slice(0, 5))}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.84rem', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.8 }}>
                          Outreach
                        </Typography>
                        {renderList(localPresencePlan.outreachSequence.slice(0, 5))}
                      </Box>
                    </Stack>
                  </Stack>
                </Box>
              ) : null}

              {result.businessSignals ? (
                <Box
                  sx={{
                    p: 1.2,
                    borderRadius: 3,
                    border: '1px solid rgba(250,204,21,0.18)',
                    bgcolor: 'rgba(71,36,0,0.18)',
                  }}
                >
                  <Stack spacing={0.9}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }} justifyContent="space-between">
                      <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>Google-signaler og anmeldelser</Typography>
                      {googleReviewsLabel ? (
                        <Chip label={googleReviewsLabel} size="small" sx={{ bgcolor: 'rgba(250,204,21,0.12)', color: '#fde68a' }} />
                      ) : null}
                    </Stack>
                    {renderClassificationChips([
                      result.businessSignals.primaryTypeDisplayName ? `Kategori: ${result.businessSignals.primaryTypeDisplayName}` : null,
                      result.businessSignals.formattedAddress ? `Adresse: ${result.businessSignals.formattedAddress}` : null,
                    ])}
                    {result.businessSignals.reviewSummary ? (
                      <Typography sx={{ color: 'rgba(226,232,240,0.88)', lineHeight: 1.6 }}>
                        {result.businessSignals.reviewSummary}
                      </Typography>
                    ) : null}
                    {result.businessSignals.serviceSignals.length > 0 ? renderClassificationChips(result.businessSignals.serviceSignals) : null}
                    {result.businessSignals.topReviews.length > 0 ? (
                      <Box>
                        <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.84rem', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.8 }}>
                          Det kundene faktisk sier
                        </Typography>
                        {renderList(result.businessSignals.topReviews.map((review) => {
                          const prefix = review.author ? `${review.author}: ` : '';
                          return `${prefix}${review.text}`;
                        }))}
                      </Box>
                    ) : null}
                  </Stack>
                </Box>
              ) : null}

              <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.2}>
                <Box
                  sx={{
                    flex: 1,
                    p: 1.2,
                    borderRadius: 3,
                    border: '1px solid rgba(59,130,246,0.16)',
                    bgcolor: 'rgba(15,23,42,0.42)',
                  }}
                >
                  <Stack spacing={0.8}>
                    <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>Story logikk</Typography>
                    <Typography sx={{ color: '#e2e8f0', fontWeight: 700 }}>
                      {String((result.storyLogicDraft.concept as Record<string, unknown> | undefined)?.corePremise || '')}
                    </Typography>
                    {renderClassificationChips([
                      typeof storyClassification?.industry === 'string'
                        ? `Bransje: ${storyClassification.industry}`
                        : result.planningDraft.contentLogic.industry
                          ? `Bransje: ${result.planningDraft.contentLogic.industry}`
                          : null,
                      typeof storyClassification?.subIndustry === 'string'
                        ? `Underbransje: ${storyClassification.subIndustry}`
                        : result.planningDraft.contentLogic.subIndustry
                          ? `Underbransje: ${result.planningDraft.contentLogic.subIndustry}`
                          : null,
                      typeof storyClassification?.contentCategory === 'string'
                        ? `Innhold: ${storyClassification.contentCategory}`
                        : result.planningDraft.contentLogic.contentCategory
                          ? `Innhold: ${result.planningDraft.contentLogic.contentCategory}`
                          : null,
                      typeof storyClassification?.productionApproach === 'string'
                        ? `Grep: ${storyClassification.productionApproach}`
                        : result.planningDraft.contentLogic.productionApproach
                          ? `Grep: ${result.planningDraft.contentLogic.productionApproach}`
                          : null,
                    ])}
                    <Typography sx={{ color: 'rgba(226,232,240,0.8)', lineHeight: 1.6 }}>
                      Hovedbudskap: {result.intakeDraft.keyMessage}
                    </Typography>
                    {contentStoryLogic ? (
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 2.4,
                          border: '1px solid rgba(34,211,238,0.14)',
                          bgcolor: 'rgba(8,47,73,0.14)',
                        }}
                      >
                        <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.8 }}>
                          Klienten bør fylle ut
                        </Typography>
                        {renderList([
                          typeof contentStoryLogic.businessObjective === 'string' ? `Forretningsmål: ${contentStoryLogic.businessObjective}` : '',
                          typeof contentStoryLogic.audienceProblem === 'string' ? `Publikumsbehov: ${contentStoryLogic.audienceProblem}` : '',
                          typeof contentStoryLogic.keyPromise === 'string' ? `Hovedløfte: ${contentStoryLogic.keyPromise}` : '',
                          typeof contentStoryLogic.desiredAction === 'string' ? `Ønsket handling: ${contentStoryLogic.desiredAction}` : '',
                          typeof contentStoryLogic.visualFocus === 'string' ? `Visuell prioritet: ${contentStoryLogic.visualFocus}` : '',
                        ].filter(Boolean))}
                      </Box>
                    ) : null}
                    {renderList(result.nextRecommendedSteps)}
                  </Stack>
                </Box>
                <Box
                  sx={{
                    flex: 1,
                    p: 1.2,
                    borderRadius: 3,
                    border: '1px solid rgba(16,185,129,0.18)',
                    bgcolor: 'rgba(6,78,59,0.14)',
                  }}
                >
                  <Stack spacing={0.8}>
                    <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>Det agenten vil fylle ut</Typography>
                    {renderList([
                      `Prosjektmål: ${result.intakeDraft.projectGoal}`,
                      `Leveranser: ${result.intakeDraft.deliverables}`,
                      `Målgruppe: ${result.intakeDraft.targetAudience}`,
                      `Bransje: ${result.planningDraft.contentLogic.industry || result.companyProfile.industry}`,
                      `Kategori: ${result.planningDraft.contentLogic.contentCategory || result.companyProfile.contentCategory}`,
                      `Retning: ${String(result.planningDraft.activationPlan.direction || '')}`,
                      `Idé: ${String(result.planningDraft.activationPlan.idea || '')}`,
                    ])}
                  </Stack>
                </Box>
              </Stack>
            </Stack>
          ) : null}
        </Stack>
        )}
      </DialogContent>
      <DialogActions
        sx={{
          px: { xs: 1.4, md: 2 },
          pb: { xs: 1.4, md: 1.8 },
          pt: 0.4,
          flexDirection: { xs: 'column-reverse', md: 'row' },
          alignItems: { xs: 'stretch', md: 'center' },
          justifyContent: { md: 'space-between' },
          gap: { xs: 1, md: 0 },
        }}
      >
        <Button
          onClick={handleCloseWithGuard}
          disabled={generating || applying}
          sx={{ textTransform: 'none', alignSelf: { xs: 'center', md: 'flex-start' } }}
        >
          Lukk
        </Button>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1}
          sx={{ width: { xs: '100%', md: 'auto' } }}
        >
          {result && onCreateProject ? (
            <Button
              variant={projectCreatedFromResult ? 'text' : 'outlined'}
              disabled={generating || applying || projectCreatedFromResult}
              onClick={handleCreateProjectAndMark}
              sx={{ textTransform: 'none', fontWeight: 800 }}
            >
              {projectCreatedFromResult ? 'Prosjekt opprettet' : 'Ja, opprett prosjekt på kunden'}
            </Button>
          ) : null}
          <Button
            variant="outlined"
            disabled={!canGenerate || generating || applying}
            onClick={() => onGenerate({
              projectId,
              projectName,
              websiteUrl,
              organizationNumber,
              companyName,
              extraContext,
            })}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {generating ? 'Analyserer…' : access?.providerConfigured ? 'Analyser kunde med OpenAI' : 'Analyser kunde'}
          </Button>
          <Button
            variant="contained"
            disabled={!result || generating || applying}
            onClick={handleApplyAndMark}
            sx={{
              textTransform: 'none',
              fontWeight: 800,
              px: 2.2,
              background: 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)',
            }}
          >
            {applying ? 'Bruker forslag…' : 'Bruk forslag'}
          </Button>
        </Stack>
      </DialogActions>

      <Dialog
        open={systemStatusOpen}
        onClose={() => setSystemStatusOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#0b1220',
            color: '#f1f5f9',
            border: '1px solid rgba(148,163,184,0.16)',
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgba(148,163,184,0.14)' }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>
            Agent system status
          </Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.85rem' }}>
            Hvilke eksterne tjenester agenten er koblet til akkurat nå.
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ p: { xs: 1.4, md: 2 } }}>
          <Stack spacing={1.4}>
            {access && !access.providerConfigured ? (
              <Alert severity="warning">
                OpenAI er ikke konfigurert i backend ennå. Agenten fungerer fortsatt, men bruker fallback-regler i stedet for ekte <strong>{access.defaultModel || 'OpenAI-modell'}</strong>.
              </Alert>
            ) : null}
            {access?.providerConfigured ? (
              <Alert severity="info">
                Agenten er satt opp mot <strong>{runtimeLabel}</strong>. Dette er standardmotoren for analyse og forslag i denne admin-testen.
              </Alert>
            ) : null}
            {access && !access.googlePlacesConfigured ? (
              <Alert severity="info">
                Google Places/review enrichment er ikke konfigurert ennå. Agenten bruker fortsatt nettside og OpenAI, men henter ikke Google-rating, anmeldelser og stedssignaler før <strong>GOOGLE_PLACES_API_KEY</strong> er satt.
              </Alert>
            ) : null}
            {access?.googlePlacesConfigured ? (
              <Alert severity="success">
                Google Places enrichment er aktiv. Agenten kan bruke rating, anmeldelser, adresse og stedssignaler i brief og story logikk.
              </Alert>
            ) : null}
            {access && !access.cohereConfigured ? (
              <Alert severity="info">
                Cohere retrieval/rerank er ikke konfigurert ennå. Agenten fungerer fortsatt, men velger ikke automatisk de mest relevante nettsidene og reviews før <strong>COHERE_API_KEY</strong> er satt.
              </Alert>
            ) : null}
            {access?.cohereConfigured ? (
              <Alert severity="success">
                Cohere retrieval/rerank er aktiv med <strong>{access.cohereRerankModel || 'rerank-v3.5'}</strong>. Agenten bruker dette til å velge de mest relevante nettsidene og anmeldelsene før OpenAI genererer forslag.
              </Alert>
            ) : null}
            {access?.brregConfigured ? (
              <Alert severity="success">
                Brreg-oppslag er aktivt. Agenten sjekker organisasjonsnummer eller firmanavn mot Enhetsregisteret før den lager prosjektgrunnlag.
              </Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 1.6 }}>
          <Button onClick={() => setSystemStatusOpen(false)} sx={{ textTransform: 'none' }}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>
      <SocialAccessRequestDialog
        open={accessRequestPlatform != null}
        onClose={() => setAccessRequestPlatform(null)}
        projectId={projectId}
        platform={accessRequestPlatform?.platform ?? 'youtube'}
        platformLabel={accessRequestPlatform?.label ?? ''}
      />

      {/* Item 1, 7, 8, 11, 18, 19, 21, 22, 23, 24, 25 — auto-opens once
          per researchId (tracked in sessionStorage). When user dismisses,
          scrolls focus to the next-step CTA. Primary action navigates to
          the marketing-plan tab so the user has a clear next-step. */}
      <RoleRoomResearchCompleteOverlay
        result={result}
        projectId={projectId}
        primaryActionLabel="Til Marketing Plan"
        onPrimaryAction={() => setActiveTab('marketing-plan')}
      />
    </Dialog>
  );
}
