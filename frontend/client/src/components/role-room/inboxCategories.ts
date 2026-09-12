/**
 * inboxCategories.ts
 *
 * Sentral, delt kategori-konfig for produsent-inboxen (Creative Sync Workspace).
 * FØR denne: chippene viste rå DB-enums ("general"/"brief"/"workspace") i én
 * og samme blåfarge, uten ikon — umulig å skanne, og "general" betød ingenting.
 *
 * Nå mappes hver `inbox_type` (og enkelte presise `event_type`) til et
 * menneskelig navn + ikon + farge, slik at desktop OG mobil viser identiske,
 * skannbare kategori-merker. Begge inbox-flater importerer herfra.
 */
import type { SvgIconComponent } from '@mui/icons-material';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';

export interface InboxCategory {
  key: string;
  /** Menneskelig etikett vist i chippen. */
  label: string;
  /** Aksentfarge (ikon, tekst, ulest-kant). */
  color: string;
  /** Chip-bakgrunn (samme nyanse, lav alpha). */
  bg: string;
  Icon: SvgIconComponent;
}

// Basis-kategoriene = inbox_type-verdiene backend utleder (inferInboxType).
const CATEGORIES: Record<string, InboxCategory> = {
  brief: { key: 'brief', label: 'Brief', color: '#60a5fa', bg: 'rgba(96,165,250,0.16)', Icon: DescriptionOutlinedIcon },
  approval: { key: 'approval', label: 'Godkjenning', color: '#34d399', bg: 'rgba(52,211,153,0.16)', Icon: CheckCircleOutlineIcon },
  material: { key: 'material', label: 'Materiale', color: '#c084fc', bg: 'rgba(192,132,252,0.16)', Icon: PhotoLibraryOutlinedIcon },
  delivery: { key: 'delivery', label: 'Leveranse', color: '#2dd4bf', bg: 'rgba(45,212,191,0.16)', Icon: MovieOutlinedIcon },
  request: { key: 'request', label: 'Forespørsel', color: '#fbbf24', bg: 'rgba(251,191,36,0.16)', Icon: HelpOutlineIcon },
  workspace: { key: 'workspace', label: 'Arbeidsflate', color: '#38bdf8', bg: 'rgba(56,189,248,0.16)', Icon: HubOutlinedIcon },
  general: { key: 'general', label: 'Varsel', color: '#94a3b8', bg: 'rgba(148,163,184,0.16)', Icon: NotificationsNoneIcon },
};

// Enkelte event_types fortjener en mer presis etikett/ikon enn inbox_type alene
// (alt-som-ikke-matcher faller til "general" hos backend — vi løfter dem her).
const EVENT_OVERRIDES: Record<string, Partial<InboxCategory>> = {
  message_sent: { label: 'Melding', Icon: ChatBubbleOutlineIcon },
  message_internal: { label: 'Intern melding', Icon: ChatBubbleOutlineIcon },
  message_request: { label: 'Forespørsel', color: '#fbbf24', bg: 'rgba(251,191,36,0.16)', Icon: HelpOutlineIcon },
  client_platform_connected: { label: 'Tilkobling', Icon: HubOutlinedIcon },
  client_granted_oauth_access: { label: 'Tilgang gitt', Icon: HubOutlinedIcon },
  client_revoked_oauth_access: { label: 'Tilgang trukket', color: '#f87171', bg: 'rgba(248,113,113,0.16)', Icon: HubOutlinedIcon },
  meeting_scheduled: { label: 'Møte', Icon: EventOutlinedIcon },
  deadline_publish_reminder: { label: 'Frist', color: '#f87171', bg: 'rgba(248,113,113,0.16)', Icon: EventOutlinedIcon },
  deadline_client_action_reminder: { label: 'Frist · klient', color: '#fbbf24', bg: 'rgba(251,191,36,0.16)', Icon: EventOutlinedIcon },
  ads_client_comment: { label: 'Ads-kommentar', Icon: CampaignOutlinedIcon },
  editor_comment_mention: { label: 'Kommentar', Icon: ChatBubbleOutlineIcon },
};

/**
 * Slår opp kategori for en inbox-rad. event_type-overstyring vinner over
 * inbox_type, som vinner over "general"-fallback.
 */
export function resolveInboxCategory(
  inboxType?: string | null,
  eventType?: string | null,
): InboxCategory {
  const base = (inboxType && CATEGORIES[inboxType]) || CATEGORIES.general;
  const override = eventType ? EVENT_OVERRIDES[eventType] : undefined;
  return override ? { ...base, ...override } : base;
}
