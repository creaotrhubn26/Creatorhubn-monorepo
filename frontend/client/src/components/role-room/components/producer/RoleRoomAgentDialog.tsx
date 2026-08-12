import { useEffect, useMemo, useState } from 'react';
import { RoleRoomAgentIcon } from './RoleRoomAgentIcon';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  AutoFixHigh as AutoFixHighIcon,
  Chat as ChatIcon,
  GridView as GridViewIcon,
  Language as LanguageIcon,
  LocalMall as MerchIcon,
  MoveToInbox as InboxIcon,
  ContactPage as LeadsTabIcon,
  CampaignOutlined as MentionsTabIcon,
  TravelExplore as DiscoveryTabIcon,
  EventOutlined as EventsTabIcon,
  MoreHoriz as MoreHorizIcon,
  Tune as TuneIcon,
  QueryStats as QueryStatsIcon,
  Rocket as RocketIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
} from '@mui/icons-material';
import RoleRoomResearchCompleteOverlay from './RoleRoomResearchCompleteOverlay';
import ResearchProgressLive from './ResearchProgressLive';
import type { ResearchStage, ResearchProgressStatus } from '../../hooks/useResearchProgress';
import MetaPagePublicMetadataInspector from './MetaPagePublicMetadataInspector';
import AdsAttributionInspector from './AdsAttributionInspector';
import FacebookVideoPublisher from './FacebookVideoPublisher';
import FacebookPageMentionPublisher from './FacebookPageMentionPublisher';
import SocialInboxPanel from './SocialInboxPanel';
import LeadsPanel from './LeadsPanel';
import MentionsPanel from './MentionsPanel';
import DiscoveryPanel from './DiscoveryPanel';
import EventsPanel from './EventsPanel';
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
import { buildClassificationFeedbackEdits } from '../../utils/roleRoomAgentFeedbackEdits';
import RoleRoomAgentChatPanel from '../ai/RoleRoomAgentChatPanel';
import { executeSetupAgentTool } from '../../services/roleRoomSetupToolExecutor';
import { roleRoomAgentDefaultHeaders } from '../../services/roleRoomAgentService';
import { ContractScanSection } from './ContractScanSection';
import RoleRoomFeedPlannerPanel from './RoleRoomFeedPlannerPanel';
import MarketingPlanPanel from './MarketingPlanPanel';
import { DailyBriefCard } from './DailyBriefCard';
import AgentDockLauncher from './AgentDockLauncher';
import AgentCommandPalette from './AgentCommandPalette';
import { isAdvancedTab } from './agentTabs';
import ResearchVersionsPickerInline from './ResearchVersionsPickerInline';
import MerchSuppliersPanel from './MerchSuppliersPanel';
import { useT, translate, getLang, type TranslationKey } from '../../../../i18n';

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
  /** Deep-link fra needsConnect/needsReauth-utfall til Kontotilgang. */
  onOpenAccountAccess?: () => void;
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
        {translate(getLang(), 'agentDlg.noSuggestionsYet')}
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

const LOCAL_OPPORTUNITY_LABELS: Record<string, TranslationKey> = {
  school: 'agentDlg.local.school',
  sports_club: 'agentDlg.local.sportsClub',
  workplace: 'agentDlg.local.workplace',
  hotel: 'agentDlg.local.hotel',
  culture: 'agentDlg.local.culture',
  retail: 'agentDlg.local.retail',
  fitness: 'agentDlg.local.fitness',
  community: 'agentDlg.local.community',
  venue: 'agentDlg.local.venue',
  tourism: 'agentDlg.local.tourism',
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
  onOpenAccountAccess,
  onCreateProject,
  progressStages,
  progressStatus,
  progressError,
  initialTab,
}: RoleRoomAgentDialogProps) {
  const { t } = useT();
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl ?? '');
  const [organizationNumber, setOrganizationNumber] = useState(initialOrganizationNumber ?? '');
  const [companyName, setCompanyName] = useState(initialCompanyName ?? '');
  const [extraContext, setExtraContext] = useState(initialExtraContext ?? '');
  // Agenten skal REGISTRERE koblingsstatus up-front — ikke først når en
  // setup-knapp feiler. Hentes ved åpning: viser om man er koblet riktig
  // (klientens konto = klient-eierskap) eller feil/mangler, før man gjør noe.
  const [connStatus, setConnStatus] = useState<{
    google: { connected: boolean; source: 'project' | 'self' | null; email: string | null };
    meta: { connected: boolean; verified: boolean; name: string | null };
    manages?: {
      ga4PropertyId: string | null;
      ga4MeasurementId: string | null;
      gscSites: string[];
      gscError: string | null;
      igUsername: string | null;
    };
  } | null>(null);
  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    void fetch(`/api/role-room/agent/connection-status/${encodeURIComponent(projectId)}`, {
      credentials: 'include',
      headers: roleRoomAgentDefaultHeaders(),
    })
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled && body?.success) {
          setConnStatus({ google: body.google, meta: body.meta, manages: body.manages });
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [open, projectId]);
  // Økonomi-kontekst (klientens budsjett-tak + faktisk forbruk + påslag +
  // kontrakt): hentes ved åpning så budsjettvakten kan vises FØR generering.
  const [economyCtx, setEconomyCtx] = useState<{
    period: string;
    budget: {
      maxSpendNok: number;
      autoPauseOnCap: boolean;
      actualSpendNok: number;
      effectiveCapNok: number;
      remainingNok: number;
      isOverBudget: boolean;
      isNearBudget: boolean;
    } | null;
    markupRate: number;
    contract: { supplier: string | null; client: string | null; totalAmount: string | null; scannedAt: string } | null;
  } | null>(null);
  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    void fetch(`/api/role-room/agent/economy-context/${encodeURIComponent(projectId)}`, {
      credentials: 'include',
      headers: roleRoomAgentDefaultHeaders(),
    })
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled && body?.success) {
          setEconomyCtx({ period: body.period, budget: body.budget, markupRate: body.markupRate, contract: body.contract });
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [open, projectId]);
  // GSC-innsikt: ekte topp-søkeord (90 dager) fra Search Console når man
  // er koblet riktig — grunnlaget for datadrevet strategi, ikke gjetting.
  const [gscInsights, setGscInsights] = useState<{
    siteUrl: string;
    period: { from: string; to: string };
    rows: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
  } | null>(null);
  const [gscInsightsBusy, setGscInsightsBusy] = useState(false);
  const [gscInsightsError, setGscInsightsError] = useState<string | null>(null);
  // «Alle koblinger registrert → synlighetsstrategi»: når systemet ser at
  // Google + Meta er riktig koblet, kan hele strategien genereres i ett
  // klikk — eventoppsett (F3-katalogen), søk/innhold på ekte GSC-data,
  // GEO/AI-synlighet og kanalplan. Data hentes best-effort og legges i
  // strategigrunnlaget før vanlig generering kjøres.
  const [visibilityStrategyBusy, setVisibilityStrategyBusy] = useState(false);
  const runVisibilityStrategy = async () => {
    setVisibilityStrategyBusy(true);
    try {
      const domain = (websiteUrl || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      let gscBlock = '';
      if (domain && connStatus?.google.connected) {
        try {
          const r = await fetch(
            `/api/role-room/agent/gsc-insights/${encodeURIComponent(projectId)}?domain=${encodeURIComponent(domain)}`,
            { credentials: 'include', headers: roleRoomAgentDefaultHeaders() },
          );
          const body = await r.json().catch(() => null);
          if (body?.success && Array.isArray(body.rows) && body.rows.length > 0) {
            gscBlock = `\nEkte Search Console-data (${body.period.from} – ${body.period.to}) for ${body.siteUrl}:\n`
              + body.rows.slice(0, 10).map((x: { query: string; clicks: number; impressions: number; position: number }) =>
                `- «${x.query}»: ${x.clicks} klikk, ${x.impressions} visninger, snittposisjon ${Number(x.position).toFixed(1)}`).join('\n');
          }
        } catch { /* best effort */ }
      }
      let eventBlock = '';
      try {
        const r = await fetch('/api/integrations/analytics-bootstrap', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...roleRoomAgentDefaultHeaders() },
          body: JSON.stringify({ goals: ['lead', 'booking'] }),
        });
        const body = await r.json().catch(() => null);
        if (Array.isArray(body?.eventPlan) && body.eventPlan.length > 0) {
          eventBlock = '\nAnbefalt event-oppsett (GA4 ↔ Meta, deterministisk katalog):\n'
            + body.eventPlan.map((e: { ga4Event: string; metaEvent?: string | null; keyEvent?: boolean }) =>
              `- ${e.ga4Event}${e.metaEvent ? ` ↔ ${e.metaEvent}` : ''}${e.keyEvent ? ' (key event)' : ''}`).join('\n');
        }
      } catch { /* best effort */ }
      // Økonomisk ramme: budsjett-tak + påslag + kontraktens betalingsmodell.
      // En Google Ads-anbefaling MÅ holdes innenfor dette — påslaget gjør at
      // hver annonsekrone har direkte fakturakonsekvens for klienten.
      let economyBlock = '';
      try {
        const r = await fetch(`/api/role-room/agent/economy-context/${encodeURIComponent(projectId)}`, {
          credentials: 'include',
          headers: roleRoomAgentDefaultHeaders(),
        });
        const body = await r.json().catch(() => null);
        if (body?.success) {
          const parts: string[] = [];
          if (body.budget) {
            const b = body.budget;
            const cap = Number(b.effectiveCapNok ?? b.maxSpendNok).toLocaleString('nb-NO');
            const spent = Number(b.actualSpendNok ?? 0).toLocaleString('nb-NO');
            const remaining = Math.max(0, Number(b.remainingNok ?? b.maxSpendNok));
            if (b.isOverBudget) {
              parts.push(`- HARD BUDSJETTVAKT: Budsjett-taket for ${body.period} (${cap} kr) er ALLEREDE NÅDD (brukt ${spent} kr). Du kan IKKE anbefale mer betalt annonsering denne perioden — foreslå kun organiske/GEO-tiltak, og be klienten heve rammen i Økonomi hvis mer Ads ønskes.`);
            } else {
              parts.push(`- HARD BUDSJETTVAKT for ${body.period}: tak ${cap} kr, brukt ${spent} kr, GJENSTÅR ${remaining.toLocaleString('nb-NO')} kr. Foreslått Google Ads-forbruk for resten av perioden MÅ være ≤ ${remaining.toLocaleString('nb-NO')} kr — overskrid det aldri. Oppgi konkret månedsbeløp og vis at det ligger under taket.${b.autoPauseOnCap ? ' (Auto-pause er PÅ: kampanjer stanser automatisk ved taket.)' : ''}`);
            }
          } else {
            parts.push(`- HARD BUDSJETTVAKT: Ingen budsjett-tak satt for ${body.period}. Ikke oppgi et konkret Ads-forbruk — foreslå et forsvarlig startbudsjett som et FORSLAG, og gjør det klart at klienten må sette rammen i Økonomi før annonser skrus på.`);
          }
          if (typeof body.markupRate === 'number') {
            parts.push(`- Påslag på annonsekostnad: ${Math.round(body.markupRate * 100)} %. Hver krone i Ads-budsjett faktureres klienten med dette påslaget — vær eksplisitt om totalkostnaden, ikke bare medieforbruket.`);
          }
          if (body.contract) {
            const c = body.contract;
            const cl: string[] = [];
            if (c.supplier || c.client) cl.push(`avtale ${c.supplier ?? '?'} ↔ ${c.client ?? '?'}`);
            if (c.totalAmount) cl.push(`ramme ${c.totalAmount}${c.currency ? ' ' + c.currency : ''}`);
            if (c.invoicing) cl.push(`fakturering: ${c.invoicing}`);
            parts.push(`- Signert kontrakt (skannet ${String(c.scannedAt).slice(0, 10)}): ${cl.join('; ') || 'betalingsmodell registrert'}. Betalt-strategien MÅ være i tråd med denne — ikke foreslå noe som bryter avtalens økonomiske rammer.`);
            if (Array.isArray(c.missingPoints) && c.missingPoints.length > 0) {
              parts.push(`  (Kontrakt-hull å ta høyde for: ${c.missingPoints.slice(0, 3).join('; ')}.)`);
            }
          } else {
            parts.push('- Ingen signert kontrakt skannet inn ennå — flagg at det økonomiske rammeverket bør bekreftes før betalt annonsering settes i gang.');
          }
          economyBlock = '\nØkonomisk ramme (budsjett + påslag + kontrakt):\n' + parts.join('\n');
        }
      } catch { /* best effort */ }
      const directive = [
        '\n\n=== SYNLIGHETSSTRATEGI (alle koblinger registrert) ===',
        'Alle kontokoblinger er på plass. Lag en komplett synlighetsstrategi for hele bedriften:',
        '1. Event-/målestrategi: konkret GA4- og Meta-pixel-eventoppsett (bruk event-planen under) og hvilke KPI-er som følges opp.',
        '2. Søk og innhold: innholdsplan bygget på de faktiske søkedataene under — styrk det som allerede fungerer, dekk gapene.',
        '3. GEO/AI-synlighet: hvordan bedriften blir synlig i ChatGPT, Perplexity og Bing (struktur, pillar-innhold, siterbarhet).',
        '4. Kanalstrategi: Instagram/Facebook/YouTube/LinkedIn med publiseringsrytme og eventer knyttet til målene.',
        '5. Betalt søk (Google Ads): kampanjestruktur og budord bygget på de FAKTISKE søkedataene under (by på det som allerede konverterer organisk, fyll hull der posisjonen er svak). GA4-key-eventene importeres som konverteringer. Holdes STRENGT innenfor den økonomiske rammen under — respekter budsjett-tak, påslag og kontrakt.',
        gscBlock,
        eventBlock,
        economyBlock,
      ].filter(Boolean).join('\n');
      const composed = extraContext.includes('=== SYNLIGHETSSTRATEGI')
        ? extraContext
        : extraContext + directive;
      setExtraContext(composed);
      void onGenerate({ projectId, projectName, websiteUrl, organizationNumber, companyName, extraContext: composed });
    } finally {
      setVisibilityStrategyBusy(false);
    }
  };
  const fetchGscInsights = async (domain: string) => {
    setGscInsightsBusy(true);
    setGscInsightsError(null);
    try {
      const r = await fetch(
        `/api/role-room/agent/gsc-insights/${encodeURIComponent(projectId)}?domain=${encodeURIComponent(domain)}`,
        { credentials: 'include', headers: roleRoomAgentDefaultHeaders() },
      );
      const body = await r.json().catch(() => null);
      if (body?.success) {
        setGscInsights({ siteUrl: body.siteUrl, period: body.period, rows: body.rows ?? [] });
      } else {
        setGscInsightsError(body?.error ?? t('agentDlg.search.failed', { status: r.status }));
      }
    } catch {
      setGscInsightsError(t('agentDlg.search.failedGeneric'));
    } finally {
      setGscInsightsBusy(false);
    }
  };

  // Refinement history — grows as the user tells the agent "actually...".
  // Each round is appended to the outgoing extraContext so Claude sees the
  // full correction trail as the newest source of truth.
  const [refinementDraft, setRefinementDraft] = useState('');
  const [refinementHistory, setRefinementHistory] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'research' | 'discovery' | 'chat' | 'merch' | 'feed-planner' | 'marketing-plan' | 'meta-page' | 'page-content' | 'ads-attribution' | 'fb-publish' | 'fb-mention' | 'ig-hashtag' | 'social-inbox' | 'mentions' | 'leads' | 'events' | 'social-analytics'>(initialTab ?? 'research');

  // Synk hvis initialTab endrer seg etter mount (dialog gjenåpnes med
  // ny tab fra parent).
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);
  const [systemStatusOpen, setSystemStatusOpen] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [advancedAnchor, setAdvancedAnchor] = useState<null | HTMLElement>(null);

  // Cmd/Ctrl+K — "hopp til fane"-palett. Only active while the dialog is open.
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setCmdkOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

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
  // den røde tråden) — that IS saving.
  const [createdResultRef, setCreatedResultRef] =
    useState<RoleRoomAgentProducerBootstrapResult | null>(null);
  const [appliedResultRef, setAppliedResultRef] =
    useState<RoleRoomAgentProducerBootstrapResult | null>(null);
  // Research output is grouped into sections to cut the long single scroll.
  // 'alle' (default) keeps the original full view; the others filter the cards
  // via CSS display (cards stay mounted — no remount/effect churn).
  const [researchSection, setResearchSection] =
    useState<'alle' | 'oversikt' | 'kanaler' | 'marked'>('alle');
  // "Bestemor-modus": lead with one field + one button; the rest is optional
  // and hidden behind a toggle so the first impression is dead simple.
  const [showMoreResearchDetails, setShowMoreResearchDetails] = useState(false);
  // Footer overflow menu — keeps one clear primary action + secondary ones tucked away.
  const [moreActionsAnchor, setMoreActionsAnchor] = useState<HTMLElement | null>(null);
  // Admin/debug chrome (role chips, System status) is hidden by default so the
  // surface reads as a product; a small gear reveals it for admins.
  const [showAdminChrome, setShowAdminChrome] = useState(false);
  // Guided flow by default: users move with the 5-step stepper + Forrige/Neste
  // instead of facing a 12-tab strip (minimal cognitive load). 'Alle faner'
  // reveals the full strip for power users.
  const [showAllTabs, setShowAllTabs] = useState(false);

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
  // Learning loop (Lag 0): let the producer correct the single most impactful
  // classification — businessModel — before applying. The accept/edit signal is
  // captured on apply and feeds the NACE→businessModel learning aggregation.
  const [businessModelChoice, setBusinessModelChoice] = useState<string | null>(null);
  useEffect(() => {
    setBusinessModelChoice(result?.companyProfile?.businessModel ?? null);
  }, [result]);
  // Ordered flow through the tabs for the guided Forrige/Neste navigation.
  // Kept deliberately SHORT (bestemor-vennlig / minst mulig kognitiv belastning):
  // only the core lead-gen journey is a forced step —
  //   Forstå kunden (Research) → Plan (Markedsplan) → Publiser (Feed-planner)
  //   → Svar (Inbox) → Få kunder (Leads) → Mål (Analytics).
  // Power tools (Oppdag/discovery, Omtaler/mentions, Arrangement/events) + the
  // App Review demo/inspector tabs + merch are all reachable via 'Alle faner',
  // so they're one click away without bloating the guided step sequence.
  // Exactly the 6 phases shown in the workflow stepper, so "Steg X av N" and the
  // stepper always agree. Chat is a utility (reachable via 'Flere verktøy'), not
  // a numbered step.
  const tabFlow = useMemo<Array<typeof activeTab>>(() => [
    'research', 'marketing-plan', 'feed-planner', 'social-inbox', 'leads', 'social-analytics',
  ], []);
  const TAB_LABELS: Record<string, string> = {
    research: 'Research', discovery: t('agentDlg.tab.discover'), merch: 'Merch', 'marketing-plan': t('agentDlg.tab.marketingPlan'),
    'feed-planner': 'Feed-planner', 'meta-page': 'Meta Page', 'page-content': 'Page Content',
    'ads-attribution': 'Ads Attribution', 'fb-publish': 'FB Publish', 'fb-mention': 'Page Mentions',
    'ig-hashtag': 'IG Hashtags', 'social-inbox': 'Inbox', mentions: t('agentDlg.tab.mentions'), leads: 'Leads', events: t('agentDlg.tab.events'), 'social-analytics': 'Analytics', chat: 'Chat',
  };
  const flowIndex = tabFlow.indexOf(activeTab);
  const showResearchSection = (s: 'oversikt' | 'kanaler' | 'marked'): boolean =>
    researchSection === 'alle' || researchSection === s;
  // OAuth-fasen (doc 14): GA4-oppsett via Admin API på produsentens
  // Google-kobling. Knappen ER bekreftelsen; resultatet viser hva som
  // faktisk ble opprettet vs gjenbrukt.
  const [ga4SetupBusy, setGa4SetupBusy] = useState(false);
  const [ga4SetupOutcome, setGa4SetupOutcome] = useState<{ ok: boolean; text: string; needsAccess?: boolean } | null>(null);
  const runGa4ApiSetup = async (domain: string) => {
    setGa4SetupBusy(true);
    setGa4SetupOutcome(null);
    try {
      const r = await fetch('/api/role-room/agent/ga4-setup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...roleRoomAgentDefaultHeaders() },
        body: JSON.stringify({ projectId, domain, goals: ['lead', 'booking'] }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok || !body?.success) {
        setGa4SetupOutcome({ ok: false, text: body?.error ?? t('agentDlg.ga4.failed', { status: r.status }), needsAccess: Boolean(body?.needsConnect || body?.needsReauth) });
        return;
      }
      const parts = [
        body.propertyCreated ? t('agentDlg.ga4.propertyCreated') : t('agentDlg.ga4.propertyReused'),
        body.measurementId ? t('agentDlg.ga4.measurementId', { id: body.measurementId }) : null,
        body.retentionSet ? t('agentDlg.ga4.retention') : null,
        body.keyEvents?.length ? `${body.keyEvents.length} key events` : null,
      ].filter(Boolean);
      setGa4SetupOutcome({ ok: true, text: `${parts.join(' · ')}. ${body.ownershipNote ?? ''} ${t('agentDlg.ga4.pasteSnippet')}` });
    } catch (e) {
      setGa4SetupOutcome({ ok: false, text: String(e) });
    } finally {
      setGa4SetupBusy(false);
    }
  };
  // GSC via API (to-fase): pending-svar bærer metataggen som må i <head>
  // før verifisering kan fullføres — deretter klikkes knappen igjen.
  const [gscSetupBusy, setGscSetupBusy] = useState(false);
  const [gscSetupOutcome, setGscSetupOutcome] = useState<{ ok: boolean; text: string; metaTag?: string | null; needsAccess?: boolean } | null>(null);
  const runGscApiSetup = async (domain: string) => {
    setGscSetupBusy(true);
    setGscSetupOutcome(null);
    try {
      const r = await fetch('/api/role-room/agent/gsc-setup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...roleRoomAgentDefaultHeaders() },
        body: JSON.stringify({ projectId, domain }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok || !body?.success) {
        setGscSetupOutcome({ ok: false, text: body?.error ?? t('agentDlg.gsc.failed', { status: r.status }), needsAccess: Boolean(body?.needsConnect || body?.needsReauth) });
        return;
      }
      if (body.verification === 'pending') {
        setGscSetupOutcome({
          ok: true,
          text: t('agentDlg.gsc.pending'),
          metaTag: body.verificationMetaTag,
        });
        return;
      }
      const parts = [
        body.verification === 'verified_now' ? t('agentDlg.gsc.verifiedNow') : t('agentDlg.gsc.alreadyVerified'),
        body.siteAdded ? t('agentDlg.gsc.siteAdded') : null,
        body.sitemapSubmitted ? t('agentDlg.gsc.sitemapSubmitted', { url: body.sitemapUrl }) : null,
      ].filter(Boolean);
      setGscSetupOutcome({ ok: true, text: `${parts.join(' · ')}. ${body.ownershipNote ?? ''}` });
    } catch (e) {
      setGscSetupOutcome({ ok: false, text: String(e) });
    } finally {
      setGscSetupBusy(false);
    }
  };
  // Delvis refresh (kun sosiale kontoer): re-skanner kundens nettsted
  // med forceRefresh (24t-cachen bypasses) uten å kjøre full research.
  const [socialRefreshBusy, setSocialRefreshBusy] = useState(false);
  const refreshSocialCandidates = async () => {
    if (!result) return;
    setSocialRefreshBusy(true);
    try {
      const r = await fetch('/api/role-room/agent/producer-bootstrap/refresh-section', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...roleRoomAgentDefaultHeaders() },
        body: JSON.stringify({
          projectId,
          section: 'social',
          forceRefresh: true,
          websiteUrl: result.companyProfile?.websiteUrl ?? websiteUrl ?? undefined,
          companyName: result.companyProfile?.companyName ?? undefined,
        }),
      });
      const body = await r.json().catch(() => null);
      if (r.ok && body?.success && Array.isArray(body.socialProfileCandidates)) {
        setSocialCandidatesOverride(body.socialProfileCandidates);
      }
    } catch {
      // stille — blokken beholder forrige liste
    } finally {
      setSocialRefreshBusy(false);
    }
  };

  // Meta Pixel via Marketing API på prosjektets Meta-kobling. Pixelen
  // KOBLES, aldri aktiveres — annonse-start er en separat beslutning.
  const [pixelSetupBusy, setPixelSetupBusy] = useState(false);
  const [pixelSetupOutcome, setPixelSetupOutcome] = useState<{ ok: boolean; text: string; needsAccess?: boolean } | null>(null);
  const runMetaPixelApiSetup = async (domain: string) => {
    setPixelSetupBusy(true);
    setPixelSetupOutcome(null);
    try {
      const r = await fetch('/api/role-room/agent/meta-pixel-setup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...roleRoomAgentDefaultHeaders() },
        body: JSON.stringify({ projectId, domain }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok || !body?.success) {
        setPixelSetupOutcome({ ok: false, text: body?.error ?? t('agentDlg.pixel.failed', { status: r.status }), needsAccess: Boolean(body?.needsConnect || body?.needsReauth) });
        return;
      }
      const parts = [
        body.pixelCreated ? t('agentDlg.pixel.created') : t('agentDlg.pixel.reused'),
        `ID ${body.pixelId}`,
        body.adAccountName ? t('agentDlg.pixel.account', { name: body.adAccountName }) : null,
      ].filter(Boolean);
      setPixelSetupOutcome({
        ok: true,
        text: `${parts.join(' · ')}. ${t('agentDlg.pixel.connectedSuffix')}`,
      });
    } catch (e) {
      setPixelSetupOutcome({ ok: false, text: String(e) });
    } finally {
      setPixelSetupBusy(false);
    }
  };
  // Derived saved-state — survives reopen, clears only when a new result object arrives.
  const projectCreatedFromResult = !!result && createdResultRef === result;
  const resultAppliedToProject = !!result && appliedResultRef === result;
  const canGenerate = companyName.trim().length > 0 || websiteUrl.trim().length > 0 || organizationNumber.trim().length > 0;
  const providerLabel = useMemo(() => {
    if (!result) return null;
    if (result.provider === 'openai') return 'Creatorhub Intelligence';
    if (result.provider === 'anthropic') return 'Creatorhub Intelligence';
    return t('agentDlg.provider.fallback');
  }, [result]);
  const runtimeLabel = useMemo(() => {
    if (!access?.provider) {
      return null;
    }
    if (access.providerConfigured) {
      return `${access.provider === 'openai' ? 'OpenAI' : access.provider} · ${access.defaultModel || t('agentDlg.runtime.modelNotSet')}`;
    }
    return t('agentDlg.runtime.openaiNotConfigured');
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
    return t('agentDlg.label.reviews', { rating: result.businessSignals.rating.toFixed(1), count: result.businessSignals.userRatingCount });
  }, [result]);
  const retrievalLabel = useMemo(() => {
    if (!result?.retrievalMeta) {
      return null;
    }
    const meta = result.retrievalMeta;
    return t('agentDlg.label.retrieval', { a: meta.websitePagesSelected, b: meta.websitePagesReviewed, c: meta.reviewsSelected, d: meta.reviewsReviewed });
  }, [result]);
  const brregCompany = result?.brregCompany ?? null;
  const brregVerified = brregCompany?.lookupStatus === 'verified';
  const brregStatusLabel = useMemo(() => {
    if (!brregCompany) return null;
    if (brregCompany.lookupStatus === 'verified') {
      return brregCompany.matchedBy === 'organization_number'
        ? t('agentDlg.brreg.verifiedOrgNr')
        : t('agentDlg.brreg.verifiedName');
    }
    if (brregCompany.lookupStatus === 'invalid') return t('agentDlg.brreg.invalidOrgNr');
    if (brregCompany.lookupStatus === 'not_found') return t('agentDlg.brreg.notFound');
    if (brregCompany.lookupStatus === 'unavailable') return t('agentDlg.brreg.unavailable');
    return null;
  }, [brregCompany]);
  const criticalAgreementCount = useMemo(
    () => (result?.agreementSuggestions ?? []).filter((entry) => entry.priority === 'critical').length,
    [result],
  );
  const agreementSuggestions = result?.agreementSuggestions ?? [];
  // Delvis refresh kan oppdatere kandidatlisten uten ny bootstrap —
  // result er avledet fra prop, så oppdateringen bor i en lokal override
  // som nullstilles når et nytt research-resultat kommer inn.
  const [socialCandidatesOverride, setSocialCandidatesOverride] =
    useState<RoleRoomAgentProducerBootstrapResult['socialProfileCandidates'] | null>(null);
  useEffect(() => { setSocialCandidatesOverride(null); }, [initialResult]);
  const socialProfileCandidates = socialCandidatesOverride ?? result?.socialProfileCandidates ?? [];
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
      ? t('agentDlg.comp.avgRating', { v: competitorAnalysis.averageRating.toFixed(1) })
      : null;
    const reviews = typeof competitorAnalysis.averageReviewCount === 'number'
      ? t('agentDlg.comp.avgReviews', { v: competitorAnalysis.averageReviewCount })
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
            t('agentDlg.confirm.unsavedClose'),
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
      // Learning loop (Lag 0): record the accept/edit signal per classification
      // field. Fire-and-forget — never blocks or fails the apply.
      if (result.researchId) {
        void roleRoomAgentService.captureFieldFeedback({
          projectId,
          researchId: result.researchId,
          edits: buildClassificationFeedbackEdits(result, businessModelChoice),
        });
      }
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
          pb: 1,
          px: { xs: 1.4, md: 3 },
          pt: { xs: 1.2, md: 1.5 },
          borderBottom: '1px solid rgba(148,163,184,0.14)',
          background: 'radial-gradient(circle at top left, rgba(34,211,238,0.18) 0%, rgba(15,23,42,0) 48%)',
          flexShrink: 0,
        }}
      >
        <Stack spacing={{ xs: 0.8, md: 1.1 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={{ xs: 1, md: 1 }}
            alignItems={{ xs: 'stretch', md: 'center' }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
              <RoleRoomAgentIcon size={44} working={generating || progressStatus === 'streaming'} />
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
                >{t('agentDlg.header.subtitle')}</Typography>
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
              {showAdminChrome ? (
                <>
                  <Tooltip title={t('agentDlg.chip.adminOnlyTip')} disableInteractive>
                    <Chip label={t('agentDlg.chip.adminOnly')} size="small" aria-label={t('agentDlg.chip.adminOnlyAria')} sx={{ bgcolor: 'rgba(15,118,110,0.18)', color: '#99f6e4' }} />
                  </Tooltip>
                  <Tooltip title={t('agentDlg.chip.roleTip')} disableInteractive>
                    <Chip
                      label={t('agentDlg.chip.roleProducer')}
                      size="small"
                      aria-label={t('agentDlg.chip.roleProducerAria')}
                      sx={{ bgcolor: 'rgba(168,85,247,0.18)', color: '#f0abfc', display: { xs: 'none', sm: 'inline-flex' } }}
                    />
                  </Tooltip>
                </>
              ) : null}
              <Tooltip title={t('agentDlg.chip.activeProject', { name: projectName })} disableInteractive>
                <Chip
                  label={projectName}
                  size="small"
                  aria-label={t('agentDlg.chip.activeProject', { name: projectName })}
                  sx={{
                    bgcolor: 'rgba(59,130,246,0.16)',
                    color: '#bfdbfe',
                    maxWidth: { xs: 160, md: 240 },
                    '& .MuiChip-label': { textOverflow: 'ellipsis', overflow: 'hidden' },
                  }}
                />
              </Tooltip>
              {showAdminChrome ? (
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
                    '&:hover': { borderColor: 'var(--role-cyan, #22d3ee)', color: 'var(--role-cyan, #22d3ee)' },
                  }}
                >
                  System status
                </Button>
              ) : null}
              <Tooltip title={showAdminChrome ? t('agentDlg.tip.hideAdmin') : t('agentDlg.tip.showAdmin')} disableInteractive>
                <IconButton
                  size="small"
                  onClick={() => setShowAdminChrome((v) => !v)}
                  aria-label={showAdminChrome ? t('agentDlg.tip.hideAdmin') : t('agentDlg.tip.showAdmin')}
                  data-testid="agent-admin-toggle"
                  sx={{ color: showAdminChrome ? 'var(--role-cyan, #22d3ee)' : 'rgba(148,163,184,0.55)' }}
                >
                  <TuneIcon fontSize="small" />
                </IconButton>
              </Tooltip>
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
      {/* Guided flow bar: step through tabs with Forrige/Neste so users don't
          have to pick among ~12. Toggle collapses the full tab strip. */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ px: { xs: 1.4, md: 2 }, py: 0.6, borderBottom: '1px solid rgba(148,163,184,0.1)', flexShrink: 0 }}
      >
        <Button
          size="small"
          variant="text"
          onClick={() => setShowAllTabs((v) => !v)}
          data-testid="agent-toggle-tabs"
          sx={{ textTransform: 'none', color: 'rgba(226,232,240,0.7)', minWidth: 0 }}
        >
          {showAllTabs ? t('agentDlg.btn.hideTools') : t('agentDlg.btn.moreTools')}
        </Button>
        <Typography sx={{ flex: 1, color: 'rgba(226,232,240,0.6)', fontSize: '0.78rem', textAlign: 'center' }}>
          {flowIndex >= 0 ? t('agentDlg.step', { n: flowIndex + 1, total: tabFlow.length, label: TAB_LABELS[activeTab] ?? '' }) : ''}
        </Typography>
        <Button
          size="small"
          variant="text"
          disabled={flowIndex <= 0}
          onClick={() => { if (flowIndex > 0) setActiveTab(tabFlow[flowIndex - 1]); }}
          data-testid="agent-prev-step"
          sx={{ textTransform: 'none', color: '#cbd5e1', minWidth: 0 }}
        >{t('agentDlg.btn.prev')}</Button>
        <Button
          size="small"
          variant="outlined"
          disabled={flowIndex < 0 || flowIndex >= tabFlow.length - 1}
          onClick={() => { if (flowIndex < tabFlow.length - 1) setActiveTab(tabFlow[flowIndex + 1]); }}
          data-testid="agent-next-step"
          sx={{ textTransform: 'none', fontWeight: 700, color: 'var(--role-cyan, #22d3ee)', borderColor: 'rgba(34,211,238,0.5)' }}
        >{t('agentDlg.btn.next')}</Button>
      </Stack>
      {showAllTabs ? (
      <Stack
        direction="row"
        alignItems="center"
        sx={{ borderBottom: '1px solid rgba(148,163,184,0.14)' }}
      >
      <Tabs
        // When an "Avansert" tab is active it isn't rendered inline, so we set
        // value=false to avoid MUI's "value not in tabs" warning; the Avansert
        // button shows the active state instead.
        value={isAdvancedTab(activeTab) ? false : activeTab}
        onChange={(_, next) => setActiveTab(next as typeof activeTab)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{
          flex: 1,
          minWidth: 0,
          px: { xs: 1, md: 2 },
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
          '& .MuiTabs-indicator': { bgcolor: 'var(--role-cyan, #22d3ee)' },
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
          label={t('agentDlg.tab.marketingPlan')}
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
          value="social-inbox"
          label="Inbox"
          icon={<InboxIcon fontSize="small" />}
          iconPosition="start"
          data-testid="agent-tab-social-inbox"
        />
        <Tab
          value="leads"
          label="Leads"
          icon={<LeadsTabIcon fontSize="small" />}
          iconPosition="start"
          data-testid="agent-tab-leads"
        />
        <Tab
          value="events"
          label={t('agentDlg.tab.events')}
          icon={<EventsTabIcon fontSize="small" />}
          iconPosition="start"
          data-testid="agent-tab-events"
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
      {/* Secondary "tool" tabs tucked into an overflow so the strip stays
          scannable. Tip: Cmd/Ctrl+K hopper rett til hvilken som helst fane. */}
      <Button
        size="small"
        onClick={(e) => setAdvancedAnchor(e.currentTarget)}
        endIcon={<KeyboardArrowDownIcon fontSize="small" />}
        data-testid="agent-tab-advanced"
        sx={{
          flexShrink: 0,
          textTransform: 'none',
          mr: { xs: 0.5, md: 1 },
          fontSize: { xs: '0.78rem', md: '0.875rem' },
          fontWeight: isAdvancedTab(activeTab) ? 700 : 600,
          color: isAdvancedTab(activeTab) ? 'var(--role-cyan, #22d3ee)' : 'rgba(226,232,240,0.72)',
        }}
      >{t('agentDlg.btn.advanced')}</Button>
      <Menu
        anchorEl={advancedAnchor}
        open={Boolean(advancedAnchor)}
        onClose={() => setAdvancedAnchor(null)}
      >
        <MenuItem
          selected={activeTab === 'discovery'}
          onClick={() => { setActiveTab('discovery'); setAdvancedAnchor(null); }}
          data-testid="agent-tab-discovery"
        >
          <DiscoveryTabIcon fontSize="small" sx={{ mr: 1 }} /> {t('agentDlg.tab.discover')}
        </MenuItem>
        <MenuItem
          selected={activeTab === 'mentions'}
          onClick={() => { setActiveTab('mentions'); setAdvancedAnchor(null); }}
          data-testid="agent-tab-mentions"
        >
          <MentionsTabIcon fontSize="small" sx={{ mr: 1 }} /> {t('agentDlg.tab.mentions')}
        </MenuItem>
        <MenuItem
          selected={activeTab === 'ads-attribution'}
          onClick={() => { setActiveTab('ads-attribution'); setAdvancedAnchor(null); }}
        >
          <QueryStatsIcon fontSize="small" sx={{ mr: 1 }} /> Ads Attribution
        </MenuItem>
      </Menu>
      </Stack>
      ) : null}
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
                {applying ? t('agentDlg.btn.saving') : t('agentDlg.btn.applyHere')}
              </Button>
              {onCreateProject ? (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleCreateProjectAndMark}
                  disabled={generating || applying}
                  sx={{ textTransform: 'none', fontWeight: 700, color: '#fcd34d', borderColor: 'rgba(251,191,36,0.5)' }}
                >{t('agentDlg.btn.createNewProject')}</Button>
              ) : null}
            </Stack>
          }
        >
          {t('agentDlg.banner.notSavedYet')} <strong>{t('agentDlg.btn.useSuggestions')}</strong> {t('agentDlg.banner.savesThemIn')} <strong>{t('agentDlg.banner.thisProject')}</strong>; <strong>{t('agentDlg.btn.createNewProject')}</strong> {t('agentDlg.banner.createsForNew')}
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
            ? t('agentDlg.banner.savedCreated')
            : t('agentDlg.banner.savedApplied')}
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

        {/* Koblings-registrering up-front: agenten viser om Google/Meta er
            koblet RIKTIG (klientens konto = klient-eierskap), koblet via
            produsentens konto (fungerer, men eierskaps-varsel), eller
            mangler — FØR man prøver oppsett eller strategi. */}
        {activeTab === 'research' && connStatus ? (
          <Box sx={{ px: { xs: 1.4, md: 2 }, pt: { xs: 1.4, md: 2 } }}>
            <Stack
              direction="row"
              spacing={0.55}
              flexWrap="wrap"
              useFlexGap
              alignItems="center"
              sx={{
                p: 0.85,
                borderRadius: 2.5,
                border: '1px solid rgba(148,163,184,0.16)',
                bgcolor: 'rgba(2,6,23,0.4)',
              }}
            >
              <Typography sx={{ color: 'rgba(226,232,240,0.82)', fontSize: '0.76rem', fontWeight: 800 }}>{t('agentDlg.conn.agentSees')}</Typography>
              <Chip
                size="small"
                label={connStatus.google.connected
                  ? (connStatus.google.source === 'project'
                    ? t('agentDlg.conn.googleClient', { email: connStatus.google.email ?? t('agentDlg.conn.unknown') })
                    : t('agentDlg.conn.googleSelf', { email: connStatus.google.email ?? t('agentDlg.conn.unknown') }))
                  : t('agentDlg.conn.googleNotConnected')}
                sx={{
                  bgcolor: connStatus.google.connected
                    ? (connStatus.google.source === 'project' ? 'rgba(34,197,94,0.16)' : 'rgba(245,158,11,0.16)')
                    : 'rgba(239,68,68,0.16)',
                  color: connStatus.google.connected
                    ? (connStatus.google.source === 'project' ? '#bbf7d0' : '#fde68a')
                    : '#fecaca',
                  fontWeight: 700,
                  fontSize: '0.7rem',
                }}
              />
              {connStatus.manages?.gscError === 'needs_reauth' ? (
                <Chip size="small" label={t('agentDlg.conn.gscNeedsReauth')}
                  sx={{ bgcolor: 'rgba(239,68,68,0.16)', color: '#fecaca', fontWeight: 700, fontSize: '0.7rem' }} />
              ) : null}
              {connStatus.manages?.ga4MeasurementId ? (
                <Chip size="small" label={`GA4: ${connStatus.manages.ga4MeasurementId}`}
                  sx={{ bgcolor: 'rgba(34,197,94,0.14)', color: '#bbf7d0', fontWeight: 700, fontSize: '0.7rem' }} />
              ) : null}
              <Chip
                size="small"
                label={connStatus.meta.connected
                  ? (connStatus.meta.verified
                    ? `${t('agentDlg.conn.metaConnected')}${connStatus.manages?.igUsername ? ` (@${connStatus.manages.igUsername})` : ''}`
                    : t('agentDlg.conn.metaUnverified'))
                  : t('agentDlg.conn.metaNotConnected')}
                sx={{
                  bgcolor: connStatus.meta.connected && connStatus.meta.verified
                    ? 'rgba(34,197,94,0.16)'
                    : connStatus.meta.connected ? 'rgba(245,158,11,0.16)' : 'rgba(148,163,184,0.14)',
                  color: connStatus.meta.connected && connStatus.meta.verified
                    ? '#bbf7d0'
                    : connStatus.meta.connected ? '#fde68a' : '#cbd5e1',
                  fontWeight: 700,
                  fontSize: '0.7rem',
                }}
              />
              {(!connStatus.google.connected || connStatus.manages?.gscError === 'needs_reauth') && onOpenAccountAccess ? (
                <Button size="small" variant="text" onClick={onOpenAccountAccess}
                  sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.72rem', minHeight: 26 }}>{t('agentDlg.conn.openAccountAccess')}</Button>
              ) : null}
            </Stack>
            {(() => {
              // Full kobling registrert → tilby hele synlighetsstrategien.
              // Delvis kobling → si ærlig hva som mangler for å låse den opp.
              const googleOk = connStatus.google.connected && connStatus.manages?.gscError !== 'needs_reauth';
              const metaOk = connStatus.meta.connected && connStatus.meta.verified;
              const missing: string[] = [];
              if (!googleOk) missing.push(connStatus.google.connected ? t('agentDlg.missing.googleReauth') : t('agentDlg.missing.googleConn'));
              if (!metaOk) missing.push(connStatus.meta.connected ? t('agentDlg.missing.metaVerify') : t('agentDlg.missing.metaConn'));
              if (missing.length === 0) {
                return (
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    flexWrap="wrap"
                    useFlexGap
                    sx={{
                      mt: 0.7,
                      p: 0.95,
                      borderRadius: 2.5,
                      border: '1px solid rgba(74,222,128,0.28)',
                      bgcolor: 'rgba(15,118,110,0.14)',
                    }}
                  >
                    <Typography sx={{ color: '#bbf7d0', fontWeight: 800, fontSize: '0.82rem' }}>{t('agentDlg.strat.allConnected')}</Typography>
                    <Typography sx={{ color: 'rgba(204,251,241,0.78)', fontSize: '0.76rem', flex: 1, minWidth: 200 }}>{t('agentDlg.strat.blurb')}</Typography>
                    {/* Synlig budsjettvakt: klientens FAKTISKE tak fra Økonomi,
                        faktisk forbruk og gjenstående ramme — før generering. */}
                    {economyCtx ? (
                      <Chip
                        size="small"
                        label={economyCtx.budget
                          ? (economyCtx.budget.isOverBudget
                            ? t('agentDlg.budget.usedUp', { cap: Number(economyCtx.budget.effectiveCapNok).toLocaleString('nb-NO') })
                            : t('agentDlg.budget.remaining', { remaining: Math.max(0, Number(economyCtx.budget.remainingNok)).toLocaleString('nb-NO'), cap: Number(economyCtx.budget.effectiveCapNok).toLocaleString('nb-NO') }))
                          : t('agentDlg.budget.none')}
                        sx={{
                          bgcolor: !economyCtx.budget
                            ? 'rgba(148,163,184,0.16)'
                            : economyCtx.budget.isOverBudget
                              ? 'rgba(239,68,68,0.18)'
                              : economyCtx.budget.isNearBudget
                                ? 'rgba(245,158,11,0.18)'
                                : 'rgba(34,197,94,0.16)',
                          color: !economyCtx.budget
                            ? '#cbd5e1'
                            : economyCtx.budget.isOverBudget
                              ? '#fecaca'
                              : economyCtx.budget.isNearBudget
                                ? '#fde68a'
                                : '#bbf7d0',
                          fontWeight: 700,
                          fontSize: '0.7rem',
                        }}
                      />
                    ) : null}
                    <Button
                      size="small"
                      variant="contained"
                      disabled={visibilityStrategyBusy || generating || applying}
                      onClick={() => { void runVisibilityStrategy(); }}
                      sx={{ textTransform: 'none', fontWeight: 800, minHeight: 34 }}
                    >
                      {visibilityStrategyBusy ? t('agentDlg.btn.gathering') : t('agentDlg.btn.buildStrategy')}
                    </Button>
                  </Stack>
                );
              }
              return (
                <Typography sx={{ color: 'rgba(148,163,184,0.75)', fontSize: '0.73rem', mt: 0.6 }}>
                  {t('agentDlg.strat.locked', { missing: missing.join(', ') })}
                </Typography>
              );
            })()}
          </Box>
        ) : null}

        {/* Proactive "Dagens brief" — surfaces the nightly cross-tab scan on
            the landing/research tab with one-click jump to the relevant tab. */}
        {activeTab === 'research' ? (
          <Box sx={{ px: { xs: 1.4, md: 2 }, pt: { xs: 1.4, md: 2 } }}>
            <DailyBriefCard
              projectId={projectId}
              onNavigate={(tab) => setActiveTab(tab as typeof activeTab)}
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
              onConfirmToolUse={async (tool) => {
                // Oppsett-verktøyene (doc 14) deler executor med
                // Research-fanens knapper. Andre forslag hører hjemme i
                // prosjekt-arbeidsflaten — si det ærlig i stedet for stille nei.
                const result = await executeSetupAgentTool(
                  { name: tool.name, input: (tool.input ?? {}) as Record<string, unknown> },
                  projectId,
                );
                if (result !== null) return result;
                return t('agentDlg.chat.confirmElsewhere');
              }}
            />
          </Box>
        ) : activeTab === 'discovery' ? (
          <DiscoveryPanel />
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
        ) : activeTab === 'mentions' ? (
          <MentionsPanel />
        ) : activeTab === 'events' ? (
          <EventsPanel />
        ) : activeTab === 'leads' ? (
          <LeadsPanel />
        ) : activeTab === 'social-analytics' ? (
          <Box sx={{ p: { xs: 1, md: 2 } }}>
            <SocialAnalyticsPanel />
          </Box>
        ) : (
        <Stack spacing={1.4}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {notice ? <Alert severity="success">{notice}</Alert> : null}

          <Box
            sx={{
              p: { xs: 1.4, md: 1.8 },
              borderRadius: 3,
              border: '1px solid rgba(34,211,238,0.22)',
              bgcolor: 'rgba(15,23,42,0.52)',
            }}
          >
            <Stack spacing={1.2}>
              <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: { xs: '1rem', md: '1.1rem' } }}>{t('agentDlg.form.pasteWebsite')}</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'flex-start' }}>
                <TextField
                  label={t('agentDlg.form.websiteLabel')}
                  value={websiteUrl}
                  onChange={(event) => setWebsiteUrl(event.target.value)}
                  fullWidth
                  placeholder="https://kunde.no"
                  InputLabelProps={{ shrink: true }}
                />
                <Button
                  variant="contained"
                  size="large"
                  disabled={!canGenerate || generating || applying}
                  onClick={() => onGenerate({
                    projectId,
                    projectName,
                    websiteUrl,
                    organizationNumber,
                    companyName,
                    extraContext,
                  })}
                  data-testid="research-find-out"
                  sx={{
                    minWidth: { sm: 220 },
                    py: 1.4,
                    fontWeight: 800,
                    textTransform: 'none',
                    whiteSpace: 'nowrap',
                    background: 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)',
                  }}
                >
                  {generating ? t('agentDlg.btn.findingOut') : t('agentDlg.btn.findOut')}
                </Button>
              </Stack>
              <Button
                variant="text"
                size="small"
                onClick={() => setShowMoreResearchDetails((v) => !v)}
                sx={{ alignSelf: 'flex-start', textTransform: 'none', color: 'rgba(226,232,240,0.7)' }}
              >
                {showMoreResearchDetails ? t('agentDlg.btn.hideMore') : t('agentDlg.btn.moreDetails')}
              </Button>
              <Collapse in={showMoreResearchDetails}>
                <Stack spacing={1.1} sx={{ pt: 0.4 }}>
                  <TextField
                    label={t('agentDlg.form.orgNumber')}
                    value={organizationNumber}
                    onChange={(event) => setOrganizationNumber(event.target.value)}
                    fullWidth
                    placeholder="999 999 999"
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label={t('agentDlg.form.companyName')}
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    fullWidth
                    placeholder="Northwind Drilling"
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label={t('agentDlg.form.extraContext')}
                    value={extraContext}
                    onChange={(event) => setExtraContext(event.target.value)}
                    fullWidth
                    multiline
                    minRows={3}
                    placeholder={t('agentDlg.form.extraPlaceholder')}
                    InputLabelProps={{ shrink: true }}
                  />
                </Stack>
              </Collapse>
            </Stack>
          </Box>
          {/* Previous research versions — demoted from the top so the first
              impression stays simple; only relevant once analyses exist. */}
          <Stack direction="row" justifyContent="flex-end">
            <ResearchVersionsPickerInline projectId={projectId} />
          </Stack>

          {/* Friendly reassurance while working (covers the case where the
              streaming progress panel above isn't active). */}
          {generating && !result && (!progressStatus || progressStatus === 'idle') ? (
            <Box
              data-testid="research-working"
              sx={{
                p: 1.6,
                borderRadius: 3,
                border: '1px solid rgba(34,211,238,0.25)',
                bgcolor: 'rgba(34,211,238,0.06)',
              }}
            >
              <Stack direction="row" spacing={1.2} alignItems="center">
                <CircularProgress size={22} sx={{ color: 'var(--role-cyan, #22d3ee)' }} />
                <Box>
                  <Typography sx={{ color: '#e2e8f0', fontWeight: 700 }}>{t('agentDlg.working.title')}</Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.84rem' }}>{t('agentDlg.working.body')}</Typography>
                </Box>
              </Stack>
            </Box>
          ) : null}

          {/* Empty state: nothing analysed yet — a warm pointer, not a blank gap. */}
          {!result && !generating ? (
            <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.86rem', textAlign: 'center', py: 1 }}>{t('agentDlg.empty.pointer')}</Typography>
          ) : null}

          {result ? (
            <Stack spacing={1.2}>
              <Alert severity={brregVerified ? 'success' : 'info'}>
                {brregVerified
                  ? t('agentDlg.result.verified', { name: result.companyProfile.companyName })
                  : brregCompany?.statusMessage || t('agentDlg.result.draftReady')}
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
                  <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.92rem' }}>{t('agentDlg.refine.title')}</Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.82rem', lineHeight: 1.5 }}>{t('agentDlg.refine.body')}</Typography>
                  {refinementHistory.length > 0 ? (
                    <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                      {refinementHistory.map((entry, index) => (
                        <Chip
                          key={`rr-refinement-${index}`}
                          label={t('agentDlg.refine.round', { n: index + 1, text: entry.length > 60 ? `${entry.slice(0, 60)}…` : entry })}
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
                      placeholder={t('agentDlg.refine.placeholder')}
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
                      {generating ? t('agentDlg.btn.changing') : t('agentDlg.btn.sendChange')}
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
                    color: 'var(--role-cyan, #22d3ee)',
                    fontWeight: 800,
                    fontSize: '0.74rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    mb: 0.6,
                  }}
                >{t('agentDlg.summary.title')}</Typography>
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
                    <Chip size="small" label={t('agentDlg.summary.socialCount', { n: socialProfileCandidates.length })} sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }} />
                  ) : null}
                  {competitorAnalysis?.competitors?.length ? (
                    <Chip size="small" label={t('agentDlg.summary.competitorCount', { n: competitorAnalysis.competitors.length })} sx={{ bgcolor: 'rgba(168,85,247,0.16)', color: '#f0abfc' }} />
                  ) : null}
                </Stack>
                {(() => {
                  const recs = (competitorAnalysis?.marketingOpportunities?.length
                    ? competitorAnalysis.marketingOpportunities
                    : localPresencePlan?.recommendedEventConcepts ?? []).slice(0, 3);
                  return recs.length > 0 ? (
                    <Box sx={{ mt: 1.2 }}>
                      <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontWeight: 700, fontSize: '0.72rem', mb: 0.4 }}>{t('agentDlg.summary.nextSteps')}</Typography>
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
                aria-label={t('agentDlg.section.aria')}
                sx={{ mb: 0.2 }}
              >
                {([
                  ['alle', t('agentDlg.section.all')],
                  ['oversikt', t('agentDlg.section.overview')],
                  ['kanaler', t('agentDlg.section.channels')],
                  ['marked', t('agentDlg.section.market')],
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
                        color: selected ? 'var(--role-cyan, #22d3ee)' : 'rgba(226,232,240,0.7)',
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
                      <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>{t('agentDlg.about.title')}</Typography>
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
                        <Chip label={t('agentDlg.chip.orgNr', { n: result.companyProfile.organizationNumber })} size="small" />
                      ) : null}
                      {brregStatusLabel ? (
                        <Chip label={brregStatusLabel} size="small" sx={{ bgcolor: brregVerified ? 'rgba(16,185,129,0.14)' : 'rgba(250,204,21,0.14)', color: brregVerified ? '#a7f3d0' : '#fde68a' }} />
                      ) : null}
                    </Stack>
                    {renderClassificationChips([
                      t('agentDlg.cls.industry', { v: result.companyProfile.industry }),
                      t('agentDlg.cls.subIndustry', { v: result.companyProfile.subIndustry }),
                      t('agentDlg.cls.model', { v: result.companyProfile.businessModel }),
                    ])}
                    {result.companyProfile.businessModel ? (
                      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.25 }}>
                        <Typography sx={{ color: 'rgba(148,163,184,0.9)', fontSize: '0.72rem' }}>{t('agentDlg.about.fixModel')}</Typography>
                        {['B2C', 'B2B', 'B2B/B2C'].map((model) => {
                          const selected = businessModelChoice === model;
                          return (
                            <Chip
                              key={model}
                              label={model}
                              size="small"
                              onClick={() => setBusinessModelChoice(model)}
                              variant={selected ? 'filled' : 'outlined'}
                              sx={{
                                cursor: 'pointer',
                                height: 22,
                                bgcolor: selected ? 'rgba(59,130,246,0.24)' : 'transparent',
                                color: selected ? '#bfdbfe' : 'rgba(203,213,225,0.85)',
                                borderColor: 'rgba(148,163,184,0.3)',
                              }}
                            />
                          );
                        })}
                      </Stack>
                    ) : null}
                    <Divider sx={{ borderColor: 'rgba(148,163,184,0.12)' }} />
                    <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.84rem', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{t('agentDlg.about.offerAudience')}</Typography>
                    {renderList([...result.companyProfile.offerings, ...result.companyProfile.targetAudience.map((entry) => t('agentDlg.cls.audience', { v: entry }))])}
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
                    <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>{t('agentDlg.branding.title')}</Typography>
                    <Typography sx={{ color: 'rgba(226,232,240,0.84)', lineHeight: 1.6 }}>
                      {result.intakeDraft.keyMessage}
                    </Typography>
                    <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.84rem', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{t('agentDlg.branding.tone')}</Typography>
                    {renderList(result.companyProfile.toneAndBrandSignals)}
                    {renderClassificationChips([
                      t('agentDlg.cls.contentCategory', { v: result.companyProfile.contentCategory }),
                      t('agentDlg.cls.productionApproach', { v: result.companyProfile.productionApproach }),
                    ])}
                    {result.planningDraft.brandGuide.logoUrl ? (
                      <Typography sx={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                        {t('agentDlg.branding.logoFound', { url: result.planningDraft.brandGuide.logoUrl })}
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
                        <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>{t('agentDlg.brreg.title')}</Typography>
                        {result.companyAge?.label ? (
                          <Chip size="small" label={result.companyAge.label} sx={{ bgcolor: 'rgba(16,185,129,0.16)', color: '#bbf7d0' }} />
                        ) : null}
                      </Stack>
                      {renderClassificationChips([
                        brregCompany?.organizationForm?.description ? t('agentDlg.cls.form', { v: brregCompany.organizationForm.description }) : null,
                        brregCompany?.industryCode?.description ? t('agentDlg.cls.nace', { v: brregCompany.industryCode.description }) : null,
                        brregCompany?.vatRegistered === true ? t('agentDlg.brreg.vatYes') : brregCompany?.vatRegistered === false ? t('agentDlg.brreg.vatNo') : null,
                        typeof brregCompany?.employeeCount === 'number' ? t('agentDlg.cls.employees', { n: brregCompany.employeeCount }) : null,
                        brregCompany?.registrationDate ? t('agentDlg.cls.registered', { date: formatNorwegianDate(brregCompany.registrationDate) ?? '' }) : null,
                      ])}
                      {brregCompany?.businessAddress ? (
                        <Typography sx={{ color: 'rgba(226,232,240,0.82)', fontSize: '0.9rem' }}>
                          {t('agentDlg.cls.address', { v: brregCompany.businessAddress })}
                        </Typography>
                      ) : null}
                      {brregCompany?.statusFlags && Object.values(brregCompany.statusFlags).some(Boolean) ? (
                        <Alert severity="warning">{t('agentDlg.brreg.statusFlags')}</Alert>
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
                      <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>{t('agentDlg.agreement.title')}</Typography>
                      {agreementSuggestions.length > 0 ? (
                        <Stack spacing={0.8}>
                          {agreementSuggestions.map((suggestion) => (
                            <Box key={suggestion.id} sx={{ p: 0.9, borderRadius: 2.2, bgcolor: 'rgba(15,23,42,0.42)', border: '1px solid rgba(148,163,184,0.12)' }}>
                              <Stack direction="row" spacing={0.7} alignItems="center" sx={{ mb: 0.4 }}>
                                <Chip
                                  size="small"
                                  label={suggestion.priority === 'critical' ? t('agentDlg.agreement.critical') : suggestion.priority === 'recommended' ? t('agentDlg.agreement.recommended') : t('agentDlg.agreement.standard')}
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
                        <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.9rem' }}>{t('agentDlg.agreement.none')}</Typography>
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
                        <Typography sx={{ color: '#f8fafc', fontWeight: 800 }}>{t('agentDlg.social.found')}</Typography>
                        <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.86rem' }}>{t('agentDlg.social.blurb')}</Typography>
                      </Box>
                      <Stack direction="row" spacing={0.8} alignItems="center">
                        <Chip
                          size="small"
                          label={t('agentDlg.social.readyCount', { shown: usableSocialProfileCandidates.length, total: socialProfileCandidates.length })}
                          sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                        />
                        <Button size="small" variant="outlined" disabled={socialRefreshBusy}
                          onClick={() => void refreshSocialCandidates()}
                          sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.74rem' }}>
                          {socialRefreshBusy ? t('agentDlg.btn.scanning') : t('agentDlg.btn.refreshFromSite')}
                        </Button>
                      </Stack>
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
                              >{t('agentDlg.btn.openAccount')}</Button>
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
                                  >{t('agentDlg.btn.requestAccess')}</Button>
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
                <Alert severity="info">{t('agentDlg.social.none')}</Alert>
              ) : null}

              {/* Site-audit (doc 14 F1): hva kundens nettsted allerede har av
                  analytics/GEO — observasjonene bak adTech-rådene i
                  marketingSetup. «unknown» = ikke observerbart utenfra
                  (consent-gatet oppsett er usynlig i initial HTML). */}
              {result?.siteSetupAudit?.capabilities?.length ? (
                <Box
                  sx={{
                    display: showResearchSection('kanaler') ? undefined : 'none',
                    p: 1.2,
                    borderRadius: 3,
                    border: '1px solid rgba(74,222,128,0.2)',
                    bgcolor: 'rgba(15,23,42,0.46)',
                  }}
                >
                  <Stack spacing={1}>
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography sx={{ color: '#f8fafc', fontWeight: 800 }}>{t('agentDlg.audit.title')}</Typography>
                        {result.siteSetupAudit?.techStack && result.siteSetupAudit.techStack.key !== 'unknown' && (
                          <Chip size="small"
                            label={t('agentDlg.audit.builtWith', { v: result.siteSetupAudit.techStack.label })}
                            sx={{ bgcolor: 'rgba(96,165,250,0.16)', color: '#93c5fd', fontWeight: 700, fontSize: '0.7rem' }} />
                        )}
                      </Stack>
                      <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.86rem' }}>{t('agentDlg.audit.blurb')}</Typography>
                    </Box>
                    {(() => {
                      const ga4Cap = result.siteSetupAudit?.capabilities.find((c) => c.key === 'ga4');
                      if (ga4Cap?.status === 'implemented') return null;
                      return (
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Button size="small" variant="outlined" disabled={ga4SetupBusy}
                            onClick={() => void runGa4ApiSetup(result.siteSetupAudit!.url)}
                            sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.78rem', color: '#bbf7d0', borderColor: 'rgba(16,185,129,0.4)' }}>
                            {ga4SetupBusy ? t('agentDlg.btn.ga4Busy') : t('agentDlg.btn.ga4Setup')}
                          </Button>
                          <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.76rem' }}>{t('agentDlg.audit.ga4Hint')}</Typography>
                        </Stack>
                      );
                    })()}
                    {ga4SetupOutcome && (
                      <Alert severity={ga4SetupOutcome.ok ? 'success' : 'warning'} sx={{ py: 0.25 }}
                        action={ga4SetupOutcome.needsAccess && onOpenAccountAccess ? (
                          <Button size="small" color="inherit" onClick={onOpenAccountAccess}
                            sx={{ textTransform: 'none', fontWeight: 700 }}>{t('agentDlg.conn.openAccountAccess')}</Button>
                        ) : undefined}>
                        {ga4SetupOutcome.text}
                      </Alert>
                    )}
                    {(() => {
                      const gscCap = result.siteSetupAudit?.capabilities.find((c) => c.key === 'gsc');
                      if (gscCap?.status === 'implemented') return null;
                      return (
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Button size="small" variant="outlined" disabled={gscSetupBusy}
                            onClick={() => void runGscApiSetup(result.siteSetupAudit!.url)}
                            sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.78rem', color: '#bfdbfe', borderColor: 'rgba(59,130,246,0.4)' }}>
                            {gscSetupBusy ? t('agentDlg.btn.gscBusy') : t('agentDlg.btn.gscSetup')}
                          </Button>
                          <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.76rem' }}>{t('agentDlg.audit.gscHint')}</Typography>
                        </Stack>
                      );
                    })()}
                    {gscSetupOutcome && (
                      <Alert severity={gscSetupOutcome.ok ? 'success' : 'warning'} sx={{ py: 0.25 }}
                        action={gscSetupOutcome.needsAccess && onOpenAccountAccess ? (
                          <Button size="small" color="inherit" onClick={onOpenAccountAccess}
                            sx={{ textTransform: 'none', fontWeight: 700 }}>{t('agentDlg.conn.openAccountAccess')}</Button>
                        ) : undefined}>
                        {gscSetupOutcome.text}
                        {gscSetupOutcome.metaTag ? (
                          <Box component="pre" sx={{ m: 0, mt: 0.5, p: 0.75, borderRadius: 1, bgcolor: 'rgba(2,6,23,0.6)', fontSize: '0.72rem', overflowX: 'auto', fontFamily: 'monospace' }}>
                            {gscSetupOutcome.metaTag}
                          </Box>
                        ) : null}
                      </Alert>
                    )}
                    {(() => {
                      const pixelCap = result.siteSetupAudit?.capabilities.find((c) => c.key === 'meta_pixel');
                      if (pixelCap?.status === 'implemented') return null;
                      return (
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Button size="small" variant="outlined" disabled={pixelSetupBusy}
                            onClick={() => void runMetaPixelApiSetup(result.siteSetupAudit!.url)}
                            sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.78rem', color: '#f0abfc', borderColor: 'rgba(168,85,247,0.4)' }}>
                            {pixelSetupBusy ? t('agentDlg.btn.pixelBusy') : t('agentDlg.btn.pixelSetup')}
                          </Button>
                          <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.76rem' }}>{t('agentDlg.audit.pixelHint')}</Typography>
                        </Stack>
                      );
                    })()}
                    {pixelSetupOutcome && (
                      <Alert severity={pixelSetupOutcome.ok ? 'success' : 'warning'} sx={{ py: 0.25 }}
                        action={pixelSetupOutcome.needsAccess && onOpenAccountAccess ? (
                          <Button size="small" color="inherit" onClick={onOpenAccountAccess}
                            sx={{ textTransform: 'none', fontWeight: 700 }}>{t('agentDlg.conn.openAccountAccess')}</Button>
                        ) : undefined}>
                        {pixelSetupOutcome.text}
                      </Alert>
                    )}
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.9} flexWrap="wrap" useFlexGap>
                      {result.siteSetupAudit.capabilities.map((cap) => {
                        const capStyle = cap.status === 'implemented'
                          ? { fg: '#bbf7d0', bg: 'rgba(16,185,129,0.16)', border: 'rgba(16,185,129,0.26)', label: t('agentDlg.cap.inPlace') }
                          : cap.status === 'partial'
                            ? { fg: '#fde68a', bg: 'rgba(250,204,21,0.12)', border: 'rgba(250,204,21,0.3)', label: t('agentDlg.cap.partial') }
                            : cap.status === 'missing'
                              ? { fg: '#fecaca', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)', label: t('agentDlg.cap.missing') }
                              : { fg: 'rgba(226,232,240,0.7)', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.2)', label: t('agentDlg.cap.notObservable') };
                        return (
                          <Box
                            key={cap.key}
                            sx={{
                              flex: '1 1 220px',
                              minWidth: 0,
                              p: 1,
                              borderRadius: 2.4,
                              border: `1px solid ${capStyle.border}`,
                              bgcolor: 'rgba(15,23,42,0.52)',
                            }}
                          >
                            <Stack spacing={0.5}>
                              <Stack direction="row" spacing={0.7} alignItems="center" justifyContent="space-between">
                                <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.88rem' }}>
                                  {cap.label}
                                </Typography>
                                <Chip size="small" label={capStyle.label}
                                  sx={{ bgcolor: capStyle.bg, color: capStyle.fg, fontWeight: 700, fontSize: '0.7rem' }} />
                              </Stack>
                              <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.8rem', lineHeight: 1.45 }}>
                                {cap.details}
                              </Typography>
                              {cap.recommendation ? (
                                <Typography sx={{ color: '#fde68a', fontSize: '0.78rem', lineHeight: 1.45 }}>
                                  → {cap.recommendation}
                                </Typography>
                              ) : null}
                            </Stack>
                          </Box>
                        );
                      })}
                    </Stack>

                    {/* Datadrevet strategi: når Google-koblingen er riktig,
                        hentes EKTE topp-søkeord fra Search Console (90 d) —
                        og kan legges rett i strategigrunnlaget for neste
                        generering. Koblet riktig skal bety noe konkret. */}
                    {connStatus?.google.connected ? (
                      <Stack spacing={0.6} sx={{ mt: 0.4 }}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Button size="small" variant="outlined" disabled={gscInsightsBusy}
                            onClick={() => {
                              const domain = (result.siteSetupAudit?.url ?? websiteUrl ?? '')
                                .replace(/^https?:\/\//, '').replace(/\/.*$/, '');
                              if (domain) void fetchGscInsights(domain);
                            }}
                            sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.78rem', color: '#a5f3fc', borderColor: 'rgba(34,211,238,0.4)' }}>
                            {gscInsightsBusy ? t('agentDlg.btn.gscInsightsBusy') : t('agentDlg.btn.gscInsights')}
                          </Button>
                          <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.76rem' }}>{t('agentDlg.audit.readonlyHint')}</Typography>
                        </Stack>
                        {gscInsightsError ? (
                          <Alert severity="warning" sx={{ py: 0.25 }}>{gscInsightsError}</Alert>
                        ) : null}
                        {gscInsights ? (
                          <Box sx={{ p: 0.9, borderRadius: 2.2, border: '1px solid rgba(34,211,238,0.2)', bgcolor: 'rgba(15,23,42,0.52)' }}>
                            <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.84rem', mb: 0.4 }}>
                              {t('agentDlg.gsc.topSearches', { site: gscInsights.siteUrl.replace(/^sc-domain:/, '').replace(/^https?:\/\//, '').replace(/\/$/, ''), from: gscInsights.period.from, to: gscInsights.period.to })}
                            </Typography>
                            {gscInsights.rows.length === 0 ? (
                              <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.78rem' }}>{t('agentDlg.gsc.noData')}</Typography>
                            ) : (
                              <>
                                <Stack spacing={0.25} sx={{ mb: 0.6 }}>
                                  {gscInsights.rows.slice(0, 8).map((row) => (
                                    <Stack key={row.query} direction="row" spacing={0.8} alignItems="baseline">
                                      <Typography sx={{ color: '#e2e8f0', fontSize: '0.78rem', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {row.query}
                                      </Typography>
                                      <Typography sx={{ color: 'rgba(148,163,184,0.85)', fontSize: '0.72rem', fontVariantNumeric: 'tabular-nums' }}>
                                        {t('agentDlg.gsc.rowStats', { clicks: row.clicks, impressions: row.impressions, pos: row.position.toFixed(1) })}
                                      </Typography>
                                    </Stack>
                                  ))}
                                </Stack>
                                <Button size="small" variant="contained"
                                  onClick={() => {
                                    const lines = gscInsights.rows.slice(0, 10)
                                      .map((row) => `- «${row.query}»: ${row.clicks} klikk, ${row.impressions} visninger, snittposisjon ${row.position.toFixed(1)}`);
                                    const block = `\n\nEkte Search Console-data for ${gscInsights.siteUrl} (${gscInsights.period.from} til ${gscInsights.period.to}) — bygg strategien på disse faktiske søkene:\n${lines.join('\n')}`;
                                    setExtraContext((current) => (current.includes('Ekte Search Console-data for') ? current : current + block));
                                  }}
                                  sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.76rem' }}>{t('agentDlg.btn.addToStrategy')}</Button>
                              </>
                            )}
                          </Box>
                        ) : null}
                      </Stack>
                    ) : null}
                  </Stack>
                </Box>
              ) : null}

              {/* Kontrakt-skann: signert avtale -> okonomisk oppsett (eget skann,
                  uavhengig av research-resultatet — trenger kun prosjektet). */}
              <Box sx={{ display: showResearchSection('marked') ? undefined : 'none' }}>
                <ContractScanSection projectId={projectId} />
              </Box>

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
                        <Typography sx={{ color: '#f8fafc', fontWeight: 800 }}>{t('agentDlg.comp.title')}</Typography>
                        <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.86rem', lineHeight: 1.5 }}>
                          {competitorAnalysis.marketContext}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                        <Chip
                          size="small"
                          label={t('agentDlg.comp.readyCount', { shown: usableCompetitors.length, total: competitorAnalysis.competitors.length })}
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
                                      ? t('agentDlg.comp.verified')
                                      : competitor.status === 'likely'
                                        ? t('agentDlg.comp.likely')
                                        : competitor.status === 'needs_review'
                                          ? t('agentDlg.comp.needsReview')
                                          : t('agentDlg.comp.rejected')
                                  }
                                  title={t('agentDlg.comp.confidence', { n: competitor.confidence })}
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
                                  ? t('agentDlg.comp.naceCode', { code: (competitor as any).naceCode })
                                  : (competitor as any).source === 'brreg_nace'
                                    ? t('agentDlg.comp.brregConfirmed')
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
                                      <Chip size="small" label={t('agentDlg.chip.followers', { n: ((competitor as any).metaPage.followersCount as number).toLocaleString('nb-NO') })} sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }} />
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
                                  <Button href={competitor.websiteUrl} target="_blank" rel="noreferrer" size="small" variant="outlined" sx={{ textTransform: 'none', fontWeight: 700 }}>{t('agentDlg.btn.website')}</Button>
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
                      <Alert severity="info">{t('agentDlg.comp.none')}</Alert>
                    )}

                    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1}>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.84rem', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.8 }}>{t('agentDlg.comp.opportunities')}</Typography>
                        {renderList(competitorAnalysis.marketingOpportunities)}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.84rem', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.8 }}>{t('agentDlg.comp.positioning')}</Typography>
                        {renderList(competitorAnalysis.positioningRecommendations)}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.84rem', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.8 }}>{t('agentDlg.comp.askCustomer')}</Typography>
                        {renderList(competitorAnalysis.producerQuestions)}
                      </Box>
                    </Stack>
                    {competitorAnalysis.limitations.length > 0 ? (
                      <Typography sx={{ color: 'rgba(226,232,240,0.56)', fontSize: '0.78rem', lineHeight: 1.5 }}>
                        {t('agentDlg.comp.limitation', { v: competitorAnalysis.limitations[0] })}
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
                        <Typography sx={{ color: '#f8fafc', fontWeight: 800 }}>{t('agentDlg.local.title')}</Typography>
                        <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.86rem', lineHeight: 1.5 }}>
                          {localPresencePlan.industryContext} · {localPresencePlan.marketArea}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={t('agentDlg.local.readyCount', { shown: usableLocalOpportunities.length, total: localPresencePlan.nearbyOpportunities.length })}
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
                                    {(LOCAL_OPPORTUNITY_LABELS[opportunity.type] ? translate(getLang(), LOCAL_OPPORTUNITY_LABELS[opportunity.type]) : opportunity.type)} · {opportunity.radiusKm} km radius
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
                                {t('agentDlg.local.partnerValue', { v: opportunity.partnerValue })}
                              </Typography>
                              {renderClassificationChips([
                                opportunity.primaryTypeDisplayName ? t('agentDlg.cls.category', { v: opportunity.primaryTypeDisplayName }) : null,
                                typeof opportunity.rating === 'number' ? t('agentDlg.cls.stars', { n: opportunity.rating.toFixed(1) }) : null,
                                opportunity.formattedAddress ? t('agentDlg.cls.address', { v: opportunity.formattedAddress }) : null,
                              ])}
                              <Typography sx={{ color: 'rgba(226,232,240,0.58)', fontSize: '0.76rem', lineHeight: 1.45 }}>
                                {opportunity.evidence.slice(0, 2).map((entry) => entry.label).join(' · ')}
                              </Typography>
                              <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                                {opportunity.websiteUrl ? (
                                  <Button href={opportunity.websiteUrl} target="_blank" rel="noreferrer" size="small" variant="outlined" sx={{ textTransform: 'none', fontWeight: 700 }}>{t('agentDlg.btn.website')}</Button>
                                ) : null}
                                {opportunity.googleMapsUri ? (
                                  <Button href={opportunity.googleMapsUri} target="_blank" rel="noreferrer" size="small" variant="outlined" sx={{ textTransform: 'none', fontWeight: 700 }}>{t('agentDlg.btn.map')}</Button>
                                ) : null}
                              </Stack>
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    ) : (
                      <Alert severity="info">{t('agentDlg.local.noPlaces')}</Alert>
                    )}

                    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1}>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.84rem', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.8 }}>{t('agentDlg.local.eventConcepts')}</Typography>
                        {renderList(localPresencePlan.recommendedEventConcepts.slice(0, 5))}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.84rem', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.8 }}>{t('agentDlg.local.contentPlan')}</Typography>
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
                      <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>{t('agentDlg.signals.title')}</Typography>
                      {googleReviewsLabel ? (
                        <Chip label={googleReviewsLabel} size="small" sx={{ bgcolor: 'rgba(250,204,21,0.12)', color: '#fde68a' }} />
                      ) : null}
                    </Stack>
                    {renderClassificationChips([
                      result.businessSignals.primaryTypeDisplayName ? t('agentDlg.cls.category', { v: result.businessSignals.primaryTypeDisplayName }) : null,
                      result.businessSignals.formattedAddress ? t('agentDlg.cls.address', { v: result.businessSignals.formattedAddress }) : null,
                    ])}
                    {result.businessSignals.reviewSummary ? (
                      <Typography sx={{ color: 'rgba(226,232,240,0.88)', lineHeight: 1.6 }}>
                        {result.businessSignals.reviewSummary}
                      </Typography>
                    ) : null}
                    {result.businessSignals.serviceSignals.length > 0 ? renderClassificationChips(result.businessSignals.serviceSignals) : null}
                    {result.businessSignals.topReviews.length > 0 ? (
                      <Box>
                        <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.84rem', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.8 }}>{t('agentDlg.signals.whatCustomersSay')}</Typography>
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
                    <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>{t('agentDlg.story.title')}</Typography>
                    <Typography sx={{ color: '#e2e8f0', fontWeight: 700 }}>
                      {String((result.storyLogicDraft.concept as Record<string, unknown> | undefined)?.corePremise || '')}
                    </Typography>
                    {renderClassificationChips([
                      typeof storyClassification?.industry === 'string'
                        ? t('agentDlg.cls.industry', { v: storyClassification.industry })
                        : result.planningDraft.contentLogic.industry
                          ? t('agentDlg.cls.industry', { v: result.planningDraft.contentLogic.industry })
                          : null,
                      typeof storyClassification?.subIndustry === 'string'
                        ? t('agentDlg.cls.subIndustry', { v: storyClassification.subIndustry })
                        : result.planningDraft.contentLogic.subIndustry
                          ? t('agentDlg.cls.subIndustry', { v: result.planningDraft.contentLogic.subIndustry })
                          : null,
                      typeof storyClassification?.contentCategory === 'string'
                        ? t('agentDlg.cls.content', { v: storyClassification.contentCategory })
                        : result.planningDraft.contentLogic.contentCategory
                          ? t('agentDlg.cls.content', { v: result.planningDraft.contentLogic.contentCategory })
                          : null,
                      typeof storyClassification?.productionApproach === 'string'
                        ? t('agentDlg.cls.approach', { v: storyClassification.productionApproach })
                        : result.planningDraft.contentLogic.productionApproach
                          ? t('agentDlg.cls.approach', { v: result.planningDraft.contentLogic.productionApproach })
                          : null,
                    ])}
                    <Typography sx={{ color: 'rgba(226,232,240,0.8)', lineHeight: 1.6 }}>
                      {t('agentDlg.story.keyMessage', { v: result.intakeDraft.keyMessage })}
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
                        <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.8 }}>{t('agentDlg.story.clientShouldFill')}</Typography>
                        {renderList([
                          typeof contentStoryLogic.businessObjective === 'string' ? t('agentDlg.cls.businessObjective', { v: contentStoryLogic.businessObjective }) : '',
                          typeof contentStoryLogic.audienceProblem === 'string' ? t('agentDlg.cls.audienceProblem', { v: contentStoryLogic.audienceProblem }) : '',
                          typeof contentStoryLogic.keyPromise === 'string' ? t('agentDlg.cls.keyPromise', { v: contentStoryLogic.keyPromise }) : '',
                          typeof contentStoryLogic.desiredAction === 'string' ? t('agentDlg.cls.desiredAction', { v: contentStoryLogic.desiredAction }) : '',
                          typeof contentStoryLogic.visualFocus === 'string' ? t('agentDlg.cls.visualFocus', { v: contentStoryLogic.visualFocus }) : '',
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
                    <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>{t('agentDlg.story.agentWillFill')}</Typography>
                    {renderList([
                      t('agentDlg.cls.projectGoal', { v: result.intakeDraft.projectGoal }),
                      t('agentDlg.cls.deliverables', { v: result.intakeDraft.deliverables }),
                      t('agentDlg.cls.audience', { v: result.intakeDraft.targetAudience }),
                      t('agentDlg.cls.industry', { v: result.planningDraft.contentLogic.industry || result.companyProfile.industry }),
                      t('agentDlg.cls.category', { v: result.planningDraft.contentLogic.contentCategory || result.companyProfile.contentCategory }),
                      t('agentDlg.cls.direction', { v: String(result.planningDraft.activationPlan.direction || '') }),
                      t('agentDlg.cls.idea', { v: String(result.planningDraft.activationPlan.idea || '') }),
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
        >{t('agentDlg.btn.close')}</Button>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1}
          sx={{ width: { xs: '100%', md: 'auto' } }}
        >
          {/* Secondary actions tucked into a "…" menu so one primary stands clear. */}
          <IconButton
            onClick={(event) => setMoreActionsAnchor(event.currentTarget)}
            disabled={generating || applying}
            aria-label={t('agentDlg.btn.moreOptions')}
            data-testid="agent-more-actions"
            sx={{
              alignSelf: { xs: 'center', md: 'auto' },
              color: 'rgba(226,232,240,0.75)',
              border: '1px solid rgba(148,163,184,0.28)',
              borderRadius: 2,
            }}
          >
            <MoreHorizIcon />
          </IconButton>
          <Menu
            anchorEl={moreActionsAnchor}
            open={Boolean(moreActionsAnchor)}
            onClose={() => setMoreActionsAnchor(null)}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          >
            {result && onCreateProject ? (
              <MenuItem
                disabled={projectCreatedFromResult}
                onClick={() => { setMoreActionsAnchor(null); void handleCreateProjectAndMark(); }}
              >
                {projectCreatedFromResult ? t('agentDlg.btn.projectCreated') : t('agentDlg.btn.createAsNewProject')}
              </MenuItem>
            ) : null}
            <MenuItem
              disabled={!canGenerate}
              onClick={() => {
                setMoreActionsAnchor(null);
                onGenerate({ projectId, projectName, websiteUrl, organizationNumber, companyName, extraContext });
              }}
            >{t('agentDlg.btn.reanalyze')}</MenuItem>
          </Menu>
          <Button
            variant="contained"
            disabled={!result || generating || applying}
            onClick={handleApplyAndMark}
            data-testid="agent-primary-apply"
            sx={{
              textTransform: 'none',
              fontWeight: 800,
              px: 2.6,
              background: 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)',
            }}
          >
            {applying ? t('agentDlg.btn.saving') : t('agentDlg.btn.useSuggestions')}
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
          <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.85rem' }}>{t('agentDlg.sys.subtitle')}</Typography>
        </DialogTitle>
        <DialogContent sx={{ p: { xs: 1.4, md: 2 } }}>
          <Stack spacing={1.4}>
            {access && !access.providerConfigured ? (
              <Alert severity="warning">
                {t('agentDlg.sys.openaiMissing1')}<strong>{access.defaultModel || t('agentDlg.sys.openaiModelFallback')}</strong>.
              </Alert>
            ) : null}
            {access?.providerConfigured ? (
              <Alert severity="info">
                {t('agentDlg.sys.providerSetup1')}<strong>{runtimeLabel}</strong>{t('agentDlg.sys.providerSetup2')}
              </Alert>
            ) : null}
            {access && !access.googlePlacesConfigured ? (
              <Alert severity="info">
                {t('agentDlg.sys.placesMissing1')}<strong>GOOGLE_PLACES_API_KEY</strong>{t('agentDlg.sys.envSet')}
              </Alert>
            ) : null}
            {access?.googlePlacesConfigured ? (
              <Alert severity="success">{t('agentDlg.sys.placesActive')}</Alert>
            ) : null}
            {access && !access.cohereConfigured ? (
              <Alert severity="info">
                {t('agentDlg.sys.cohereMissing1')}<strong>COHERE_API_KEY</strong>{t('agentDlg.sys.envSet')}
              </Alert>
            ) : null}
            {access?.cohereConfigured ? (
              <Alert severity="success">
                {t('agentDlg.sys.cohereActive1')}<strong>{access.cohereRerankModel || 'rerank-v3.5'}</strong>{t('agentDlg.sys.cohereActive2')}
              </Alert>
            ) : null}
            {access?.brregConfigured ? (
              <Alert severity="success">{t('agentDlg.sys.brregActive')}</Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 1.6 }}>
          <Button onClick={() => setSystemStatusOpen(false)} sx={{ textTransform: 'none' }}>{t('agentDlg.btn.close')}</Button>
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
        primaryActionLabel={t('agentDlg.overlay.toMarketingPlan')}
        onPrimaryAction={() => setActiveTab('marketing-plan')}
      />

      {/* Docked agent — reachable from any tab without leaving your place. */}
      {currentUserId ? (
        <AgentDockLauncher
          projectId={projectId}
          currentUserId={currentUserId}
          context={{ briefSummary: initialExtraContext ?? undefined }}
        />
      ) : null}

      {/* Cmd/Ctrl+K — hopp til hvilken som helst fane. */}
      <AgentCommandPalette
        open={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
        includeChat={Boolean(currentUserId)}
        onSelect={(tab) => setActiveTab(tab as typeof activeTab)}
      />
    </Dialog>
  );
}
