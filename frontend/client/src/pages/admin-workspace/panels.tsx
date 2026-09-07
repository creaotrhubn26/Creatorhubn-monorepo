/**
 * panels — ett register over hva hver flate viser.
 *
 * Erstatter en 313-linjers switch med 36 case i AdminWorkspace.tsx som
 * både bestemte tittel, brødsmuler og statuschip OG monterte
 * komponenten. To problemer med den:
 *
 *   1. Den måtte holdes manuelt i sync med workspaceItems.ts, som
 *      allerede eier id, label og gruppe.
 *   2. Alle ~25 tab-komponentene var statisk importert i AdminWorkspace.
 *      Kjeden MarketingCockpitTab → LeadMapPanel → leaflet, pluss hele
 *      AdminRoom (4786 linjer), gjorde at Oversikt hentet 2690 moduler
 *      og brukte 15,5 s på å vise et kort-rutenett med ingenting av det.
 *
 * Her er hver tung flate en `lazy()`, så du laster nøyaktig den flaten du
 * åpner. Lette flater som alltid (eller nesten alltid) trengs — Oversikt,
 * Innboks, teamspace-landinger — er eager, siden en Suspense-blink på
 * standardflaten koster mer enn den sparer.
 *
 * AdminWorkspace mounter resultatet bak både ErrorBoundary og Suspense.
 */

import { lazy, type ComponentType, type ReactNode } from 'react';

import type { WorkspaceNotification, WorkspaceProductScope } from '../../services/adminRoomApi';
import { OverviewView } from './OverviewView';
import { InboxView } from './InboxView';
import { TeamspaceLanding } from './TeamspaceLanding';
import type { WorkspacePrefs } from './prefs';
import {
  getWorkspaceItemLabel,
  type AdminProductId,
  type WorkspaceItemId,
  type WorkspaceLinkTarget,
} from './workspaceItems';

// ─────────────────────────────────────────────────────────
// Lazy-flater
//
// Named exports må pakkes til default for lazy(). Import-stiene er
// relative til denne fila (client/src/pages/admin-workspace/).
// ─────────────────────────────────────────────────────────

/**
 * De fleste av disse flatene ligger som NAMED export i store, delte
 * moduler (AdminRoom.tsx m.fl.). lazy() vil ha en default, så vi pakker.
 * Ingen av dem tar props når de mountes her.
 */
type NoProps = Record<string, unknown>;

const named = (loader: () => Promise<Record<string, unknown>>, key: string) =>
  lazy(async () => ({ default: (await loader())[key] as ComponentType<NoProps> }));

// Workspace-flater
const SakerTab = lazy(() => import('./SakerTab').then((m) => ({ default: m.SakerTab })));
const OppgaverTab = lazy(() => import('./OppgaverTab'));
const KalenderTab = lazy(() => import('./KalenderTab'));
const ProsjekterTab = lazy(() => import('./ProsjekterTab'));
const DokumenterTab = lazy(() => import('./DokumenterTab'));
const FilerTab = lazy(() => import('./FilerTab'));
const TeamchatTab = lazy(() => import('./TeamchatTab'));
const AutomatiseringerTab = lazy(() => import('./AutomatiseringerTab'));
const KundeprosjektTab = lazy(() => import('./KundeprosjektTab'));
const HrTab = lazy(() => import('./HrTab'));
const InnstillingerTab = lazy(() => import('./InnstillingerTab'));
const LeadgridAppWaitlistTab = lazy(() =>
  import('./LeadgridAppWaitlistTab').then((m) => ({ default: m.LeadgridAppWaitlistTab })),
);

// Ledelse — bor i AdminRoom.tsx (4786 linjer). Denne ene import-kjeden
// var alene en stor del av oppstartskostnaden.
const BusinessPlanTab = named(() => import('../AdminRoom'), 'BusinessPlanTab');
const FundingAppsTab = named(() => import('../AdminRoom'), 'FundingAppsTab');
const InvestorContactsTab = named(() => import('../AdminRoom'), 'InvestorContactsTab');
const PartnerContactsTab = named(() => import('../AdminRoom'), 'PartnerContactsTab');
const ActivityLogTab = named(() => import('../AdminRoom'), 'ActivityLogTab');

// Markedsføring
const IndustryTargetsTab = named(
  () => import('../../components/admin/content-marketing/IndustryTargetsTab'),
  'IndustryTargetsTab',
);
const MarketingSegmentsTab = named(
  () => import('../../components/admin/content-marketing/MarketingSegmentsTab'),
  'MarketingSegmentsTab',
);
const BusinessDnaOnboarding = named(
  () => import('../../components/admin/content-marketing/BusinessDnaOnboarding'),
  'BusinessDnaOnboarding',
);
const MarketingCatalogTab = named(
  () => import('../../components/admin/content-marketing/MarketingCatalogTab'),
  'MarketingCatalogTab',
);
const ContentMarketingTab = named(
  () => import('../../components/admin/content-marketing/ContentMarketingTab'),
  'ContentMarketingTab',
);
const AiCitationTab = named(
  () => import('../../components/admin/content-marketing/AiCitationTab'),
  'AiCitationTab',
);
const NewsletterStudioTab = named(
  () => import('../../components/admin/content-marketing/NewsletterStudioTab'),
  'NewsletterStudioTab',
);
const RoleRoomEconomyTab = named(
  () => import('../../components/admin/content-marketing/RoleRoomEconomyTab'),
  'RoleRoomEconomyTab',
);
const OperatingSystemTab = named(
  () => import('../../components/admin/content-marketing/OperatingSystemTab'),
  'OperatingSystemTab',
);

// Denne drar inn LeadMapPanel (5639 linjer) og leaflet.
const MarketingCockpitTab = lazy(() => import('../admin-room/MarketingCockpitTab'));
const RoleRoomAgentTab = lazy(() => import('../admin-room/RoleRoomAgentTab'));
const ContentCalendarTab = lazy(() => import('../admin-room/ContentCalendarTab'));

// Produkt
const MigrationsTab = named(
  () => import('../../components/role-room/components/admin-room/MigrationsTab'),
  'MigrationsTab',
);
const WhatsNewTab = named(
  () => import('../../components/role-room/components/admin-room/WhatsNewTab'),
  'WhatsNewTab',
);

// ─────────────────────────────────────────────────────────
// Kontrakt
// ─────────────────────────────────────────────────────────

/** Alt en flate kan trenge. Sendes inn av AdminWorkspace. */
export interface PanelContext {
  product: AdminProductId;
  productScope: WorkspaceProductScope;
  notifications: WorkspaceNotification[];
  notificationsLoading: boolean;
  notificationsError: string | null;
  onMarkNotificationSeen: (id: string) => void;
  onJumpTo: (id: WorkspaceItemId) => void;
  onNavigate: (target: WorkspaceLinkTarget) => void;
  onOpenCase: (caseId: string) => void;
  pendingCaseId: string | null;
  onCaseConsumed: () => void;
  onPrefsChange: (prefs: WorkspacePrefs) => void;
  /** Aktiv undertab, for flater som har `contentTabs`. */
  activeContentTab: number;
}

export interface PanelDef {
  /** Overstyrer label fra workspaceItems når overskriften skal si noe annet. */
  title?: string;
  /** Midtleddet i brødsmulene; første og siste settes automatisk. */
  trail: string;
  /** Siste brødsmule når den skal avvike fra tittelen. */
  crumb?: string;
  statusChip?: (ctx: PanelContext) => { label: string; color: string } | undefined;
  contentTabs?: string[];
  render: (ctx: PanelContext) => ReactNode;
}

const LIVE = { label: 'Live', color: '#22c55e' } as const;
const live = () => LIVE;

export const PANELS: Record<WorkspaceItemId, PanelDef> = {
  // ── Workspace ────────────────────────────────────────────
  overview: {
    trail: 'Workspace',
    statusChip: live,
    render: (c) => <OverviewView onJumpTo={c.onJumpTo} product={c.product} />,
  },
  inbox: {
    trail: 'Workspace',
    statusChip: (c) =>
      c.notificationsError
        ? { label: 'Ukjent', color: '#fda4af' }
        : c.notifications.length > 0
          ? { label: `${c.notifications.length} uleste`, color: '#7c3aed' }
          : { label: 'Alt klart', color: '#22c55e' },
    render: (c) => (
      <InboxView
        notifications={c.notifications}
        loading={c.notificationsLoading}
        error={c.notificationsError}
        onMarkSeen={c.onMarkNotificationSeen}
      />
    ),
  },
  cases: {
    trail: 'Workspace',
    render: (c) => (
      <SakerTab
        parentProduct={c.product}
        initialCaseId={c.pendingCaseId}
        onInitialCaseConsumed={c.onCaseConsumed}
      />
    ),
  },
  tasks: {
    trail: 'Workspace',
    statusChip: live,
    render: (c) => <OppgaverTab parentProduct={c.product} onOpenCase={c.onOpenCase} />,
  },
  calendar: {
    trail: 'Workspace',
    statusChip: live,
    render: (c) => <KalenderTab product={c.productScope} onNavigate={c.onNavigate} />,
  },
  activity: {
    trail: 'Workspace',
    crumb: 'Aktivitet',
    render: () => <ActivityLogTab />,
  },
  projects: {
    trail: 'Workspace',
    statusChip: live,
    render: (c) => <ProsjekterTab product={c.productScope} />,
  },
  documents: {
    trail: 'Workspace',
    statusChip: live,
    render: (c) => <DokumenterTab product={c.productScope} />,
  },
  files: {
    trail: 'Workspace',
    statusChip: live,
    render: (c) => <FilerTab product={c.productScope} />,
  },
  teamchat: {
    trail: 'Workspace',
    statusChip: live,
    render: () => <TeamchatTab />,
  },
  automations: {
    trail: 'Workspace',
    statusChip: live,
    render: () => <AutomatiseringerTab />,
  },

  // ── Ledelse ──────────────────────────────────────────────
  'business-plan': {
    trail: 'Ledelse',
    statusChip: () => ({ label: 'Autosave', color: '#22c55e' }),
    contentTabs: ['Oversikt', 'Aktivitet'],
    render: (c) => (c.activeContentTab === 1 ? <ActivityLogTab /> : <BusinessPlanTab />),
  },
  funding: { trail: 'Ledelse', crumb: 'Søknader', render: () => <FundingAppsTab /> },
  investors: { trail: 'Ledelse', render: () => <InvestorContactsTab /> },
  partners: { trail: 'Ledelse', render: () => <PartnerContactsTab /> },
  'role-room-economy': { trail: 'Ledelse', crumb: 'Økonomi', render: () => <RoleRoomEconomyTab /> },

  // ── Markedsføring ────────────────────────────────────────
  'industry-crm': {
    trail: 'Markedsføring',
    crumb: 'Tier-1 CRM',
    render: () => <IndustryTargetsTab />,
  },
  'business-dna': { trail: 'Markedsføring', render: () => <BusinessDnaOnboarding /> },
  'marketing-catalog': { trail: 'Markedsføring', render: () => <MarketingCatalogTab /> },
  'marketing-segments': { trail: 'Markedsføring', render: () => <MarketingSegmentsTab /> },
  'content-marketing': { trail: 'Markedsføring', render: () => <ContentMarketingTab /> },
  'marketing-cockpit': {
    trail: 'Markedsføring',
    crumb: 'Cockpit',
    render: () => <MarketingCockpitTab />,
  },
  'content-calendar': {
    trail: 'Markedsføring',
    crumb: 'Kalender',
    render: () => <ContentCalendarTab />,
  },
  'newsletter-studio': {
    trail: 'Markedsføring',
    crumb: 'Newsletter',
    render: () => <NewsletterStudioTab />,
  },
  'ai-citation': { trail: 'Markedsføring', render: () => <AiCitationTab /> },
  'leadgrid-app-waitlist': {
    title: 'App-venteliste',
    trail: 'Markedsføring',
    crumb: 'Leadgrid: App-venteliste',
    render: () => <LeadgridAppWaitlistTab />,
  },

  // ── Produkt ──────────────────────────────────────────────
  'operating-system': { trail: 'Produkt', render: () => <OperatingSystemTab /> },
  'role-room-agent': { trail: 'Produkt', crumb: 'AI Agent', render: () => <RoleRoomAgentTab /> },
  'whats-new': { trail: 'Produkt', render: () => <WhatsNewTab /> },
  migrations: { trail: 'Produkt', render: () => <MigrationsTab /> },

  // ── Teamspaces ───────────────────────────────────────────
  ledelse: {
    trail: 'Teamspaces',
    render: (c) => (
      <TeamspaceLanding
        label="Ledelse"
        cards={[
          { id: 'business-plan', label: 'Forretningsplan' },
          { id: 'funding', label: 'Søknader (IN/EU)' },
          { id: 'investors', label: 'Investor-pipeline' },
          { id: 'partners', label: 'Samarbeidspartnere' },
          { id: 'role-room-economy', label: 'RR Økonomi' },
        ]}
        onJumpTo={c.onJumpTo}
      />
    ),
  },
  markedsforing: {
    trail: 'Teamspaces',
    render: (c) => (
      <TeamspaceLanding
        label="Markedsføring"
        cards={[
          { id: 'business-dna', label: 'Business DNA' },
          { id: 'marketing-catalog', label: 'Katalog' },
          { id: 'marketing-cockpit', label: 'Marketing Cockpit' },
          { id: 'leadgrid-app-waitlist', label: 'Leadgrid: App-venteliste' },
          { id: 'content-marketing', label: 'Content marketing' },
          { id: 'content-calendar', label: 'Content-kalender' },
          { id: 'newsletter-studio', label: 'Newsletter Studio' },
          { id: 'ai-citation', label: 'GEO-effekt' },
          { id: 'industry-crm', label: 'Tier-1 outreach' },
          { id: 'marketing-segments', label: 'Målgrupper' },
        ]}
        onJumpTo={c.onJumpTo}
      />
    ),
  },
  produkt: {
    trail: 'Teamspaces',
    render: (c) => (
      <TeamspaceLanding
        label="Produkt"
        cards={[
          { id: 'operating-system', label: 'Operativsystem' },
          { id: 'role-room-agent', label: 'Role Room Agent' },
          { id: 'whats-new', label: 'Hva er nytt' },
          { id: 'migrations', label: 'Migrasjoner' },
        ]}
        onJumpTo={c.onJumpTo}
      />
    ),
  },
  kundeprosjekt: {
    trail: 'Teamspaces',
    statusChip: live,
    render: () => <KundeprosjektTab />,
  },
  hr: {
    trail: 'Teamspaces',
    statusChip: live,
    render: (c) => <HrTab product={c.productScope} />,
  },

  // ── Innstillinger ────────────────────────────────────────
  settings: {
    trail: 'Innstillinger',
    statusChip: live,
    render: (c) => <InnstillingerTab onPrefsChange={c.onPrefsChange} />,
  },
};

export interface ResolvedPanel {
  title: string;
  breadcrumbs: string[];
  statusChip?: { label: string; color: string };
  contentTabs?: string[];
  render: () => ReactNode;
}

/**
 * Slår opp flaten. Tittel og siste brødsmule kommer fra registeret i
 * workspaceItems.ts med mindre panelet overstyrer, så de to filene ikke
 * kan komme i utakt om en flate døpes om.
 */
export function resolvePanel(id: WorkspaceItemId, ctx: PanelContext): ResolvedPanel {
  const def = PANELS[id];
  const label = getWorkspaceItemLabel(id);
  const title = def.title ?? label;
  return {
    title,
    breadcrumbs: ['Creatorhub AS', def.trail, def.crumb ?? title],
    statusChip: def.statusChip?.(ctx),
    contentTabs: def.contentTabs,
    render: () => def.render(ctx),
  };
}
