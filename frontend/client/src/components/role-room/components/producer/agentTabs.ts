/**
 * agentTabs.ts — Informasjons-arkitektur for de 17 fanene i RoleRoomAgentDialog.
 *
 * Ren data/typer (ingen UI, ingen @mui-import) slik at dialogen kan importere dette
 * uten å dra inn render-avhengigheter. Dialogen veksler fortsatt på de SAMME
 * `TabId`-streng-literalene — denne fila omorganiserer dem bare i 6 produsent-faser
 * og markerer de 8 sekundære/verktøy-fanene som `advanced` for «Avansert»-overflow.
 *
 * Ikoner med vilje utelatt — dialogen eier allerede ikon-mappingen.
 */

/** Identisk union med RoleRoomAgentDialog sin `activeTab` (17 ids). */
export type TabId =
  | 'research'
  | 'discovery'
  | 'chat'
  | 'merch'
  | 'feed-planner'
  | 'marketing-plan'
  | 'meta-page'
  | 'page-content'
  | 'ads-attribution'
  | 'fb-publish'
  | 'fb-mention'
  | 'ig-hashtag'
  | 'social-inbox'
  | 'mentions'
  | 'leads'
  | 'events'
  | 'social-analytics';

/** De 6 produsent-arbeidsfasene (ordnet venstre→høyre i flyten). */
export type AgentTabGroupId =
  | 'research'
  | 'markedsplan'
  | 'feed'
  | 'inbox'
  | 'leads'
  | 'analytics';

export interface AgentTabGroup {
  /** Gruppe-id (fase). */
  id: AgentTabGroupId;
  /** Norsk visningsnavn for fasen. */
  label: string;
  /** Hoved-faner som alltid vises i fasen. */
  primaryTabs: TabId[];
  /** Verktøy-/sekundær-faner som tuckes inn i «Avansert»-overflow. */
  advancedTabs: TabId[];
}

export interface AgentTabMeta {
  id: TabId;
  /** Norsk visningsnavn (matcher TAB_LABELS i dialogen). */
  label: string;
  /** Hvilken fase fanen tilhører. `null` = frittstående (chat). */
  group: AgentTabGroupId | null;
  /** Om fanen skal gjemmes bak «Avansert»-overflow. */
  advanced: boolean;
}

/**
 * De 6 fasene i rekkefølge. De 8 advancedTabs er de sekundære verktøy-fanene:
 * discovery, meta-page, page-content, ig-hashtag, fb-publish, mentions,
 * fb-mention, ads-attribution.
 */
export const AGENT_TAB_GROUPS: readonly AgentTabGroup[] = [
  {
    id: 'research',
    label: 'Research',
    primaryTabs: ['research', 'merch'],
    advancedTabs: ['discovery'],
  },
  {
    id: 'markedsplan',
    label: 'Markedsplan',
    primaryTabs: ['marketing-plan'],
    advancedTabs: ['meta-page', 'page-content'],
  },
  {
    id: 'feed',
    label: 'Feed',
    primaryTabs: ['feed-planner'],
    advancedTabs: ['ig-hashtag', 'fb-publish'],
  },
  {
    id: 'inbox',
    label: 'Inbox',
    primaryTabs: ['social-inbox'],
    advancedTabs: ['mentions', 'fb-mention'],
  },
  {
    id: 'leads',
    label: 'Leads',
    primaryTabs: ['leads', 'events'],
    advancedTabs: ['ads-attribution'],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    primaryTabs: ['social-analytics'],
    advancedTabs: [],
  },
];

/**
 * Norsk visningsnavn per fane (speiler TAB_LABELS i RoleRoomAgentDialog).
 * `chat` er frittstående og tilhører ingen fase.
 */
const TAB_LABELS: Record<TabId, string> = {
  research: 'Research',
  discovery: 'Oppdag',
  chat: 'Chat',
  merch: 'Merch',
  'feed-planner': 'Feed-planner',
  'marketing-plan': 'Markedsplan',
  'meta-page': 'Meta Page',
  'page-content': 'Page Content',
  'ads-attribution': 'Ads Attribution',
  'fb-publish': 'FB Publish',
  'fb-mention': 'Page Mentions',
  'ig-hashtag': 'IG Hashtags',
  'social-inbox': 'Inbox',
  mentions: 'Omtaler',
  leads: 'Leads',
  events: 'Arrangement',
  'social-analytics': 'Analytics',
};

function buildTabMeta(): Record<TabId, AgentTabMeta> {
  const map = {} as Record<TabId, AgentTabMeta>;
  // Frittstående chat-fane (ikke i noen fase, ikke avansert).
  map.chat = { id: 'chat', label: TAB_LABELS.chat, group: null, advanced: false };
  for (const grp of AGENT_TAB_GROUPS) {
    for (const id of grp.primaryTabs) {
      map[id] = { id, label: TAB_LABELS[id], group: grp.id, advanced: false };
    }
    for (const id of grp.advancedTabs) {
      map[id] = { id, label: TAB_LABELS[id], group: grp.id, advanced: true };
    }
  }
  return map;
}

/** Oppslag fane-id → metadata (id, label, group, advanced). */
export const AGENT_TABS: Record<TabId, AgentTabMeta> = buildTabMeta();

/** Alle hoved-fane-ids i fase-rekkefølge (ekskl. chat og avanserte). */
export const PRIMARY_TAB_IDS: readonly TabId[] = AGENT_TAB_GROUPS.flatMap(
  (g) => g.primaryTabs,
);

/** De 8 avanserte/verktøy-fane-ids i fase-rekkefølge. */
export const ADVANCED_TAB_IDS: readonly TabId[] = AGENT_TAB_GROUPS.flatMap(
  (g) => g.advancedTabs,
);

/** Returner fasen en fane tilhører, eller `null` (chat / ukjent). */
export function groupForTab(tabId: TabId): AgentTabGroup | null {
  for (const grp of AGENT_TAB_GROUPS) {
    if (grp.primaryTabs.includes(tabId) || grp.advancedTabs.includes(tabId)) {
      return grp;
    }
  }
  return null;
}

/** Metadata for en gitt fane (eller undefined hvis ukjent id). */
export function tabMeta(tabId: TabId): AgentTabMeta | undefined {
  return AGENT_TABS[tabId];
}

/** True hvis fanen skal ligge bak «Avansert»-overflow. */
export function isAdvancedTab(tabId: TabId): boolean {
  return ADVANCED_TAB_IDS.includes(tabId);
}
