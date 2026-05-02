/**
 * Sentralisert mapping mellom approval-state-enum og bruker-vendt
 * norsk språk + farger. Aldri eksponer rå state-verdier i UI.
 */
import type { RoleRoomFeedApprovalState } from '../services/roleRoomAgentService';

export interface FeedApprovalDescriptor {
  /** Bruker-vendt etikett (norsk). */
  label: string;
  /** En-til-to setninger som forklarer hva tilstanden betyr. */
  description: string;
  /** Tekstfarge for chip + ikoner. */
  color: string;
  /** Bakgrunnsfarge for chip (med transparency). */
  bgColor: string;
  /** Border-farge for chip. */
  borderColor: string;
  /** Lenke-tekst på CTA-knapp som flytter posten ut av denne tilstanden. */
  primaryActionLabel: string | null;
  /** Hva primær-CTA gjør (next state). */
  primaryActionTarget: RoleRoomFeedApprovalState | null;
}

const DESCRIPTORS: Record<RoleRoomFeedApprovalState, FeedApprovalDescriptor> = {
  draft: {
    label: 'Utkast',
    description: 'Ikke godkjent ennå. Posten publiseres ikke før den er godkjent.',
    color: '#cbd5e1',
    bgColor: 'rgba(148,163,184,0.18)',
    borderColor: 'rgba(148,163,184,0.45)',
    primaryActionLabel: 'Godkjenn',
    primaryActionTarget: 'approved',
  },
  approved: {
    label: 'Godkjent',
    description: 'Klar for å planlegges eller publiseres umiddelbart.',
    color: '#86efac',
    bgColor: 'rgba(134,239,172,0.18)',
    borderColor: 'rgba(134,239,172,0.5)',
    primaryActionLabel: 'Tilbake til utkast',
    primaryActionTarget: 'draft',
  },
  scheduled: {
    label: 'Planlagt',
    description: 'Vil publiseres automatisk på det tidspunktet du har valgt.',
    color: '#7dd3fc',
    bgColor: 'rgba(125,211,252,0.18)',
    borderColor: 'rgba(125,211,252,0.5)',
    primaryActionLabel: 'Avbryt planlegging',
    primaryActionTarget: 'approved',
  },
  published: {
    label: 'Publisert',
    description: 'Live på plattformen. Tilbakemeldinger kommer inn i Inbox.',
    color: '#22d3ee',
    bgColor: 'rgba(34,211,238,0.18)',
    borderColor: 'rgba(34,211,238,0.5)',
    primaryActionLabel: null,
    primaryActionTarget: null,
  },
  rejected: {
    label: 'Avvist',
    description: 'Avslått. Rediger eller fjern fra planen.',
    color: '#fca5a5',
    bgColor: 'rgba(248,113,113,0.18)',
    borderColor: 'rgba(248,113,113,0.5)',
    primaryActionLabel: 'Tilbake til utkast',
    primaryActionTarget: 'draft',
  },
  needs_changes: {
    label: 'Trenger endring',
    description: 'Reviewer har bedt om justeringer. Se kommentar og rediger.',
    color: '#fbbf24',
    bgColor: 'rgba(251,191,36,0.18)',
    borderColor: 'rgba(251,191,36,0.5)',
    primaryActionLabel: 'Send inn på nytt',
    primaryActionTarget: 'draft',
  },
};

export function describeApprovalState(
  state: RoleRoomFeedApprovalState | undefined | null,
): FeedApprovalDescriptor {
  if (!state) return DESCRIPTORS.draft;
  return DESCRIPTORS[state] ?? DESCRIPTORS.draft;
}

export const APPROVAL_STATE_DESCRIPTORS = DESCRIPTORS;
