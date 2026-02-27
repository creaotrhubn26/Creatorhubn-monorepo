export type RoleWorkflowStatus =
  | 'draft'
  | 'open'
  | 'casting'
  | 'filled'
  | 'cancelled';

export interface RoleWorkflowMeta {
  status: RoleWorkflowStatus;
  label: string;
  color: string;
  order: number;
  allowedTransitions: RoleWorkflowStatus[];
}

const WORKFLOW: Record<RoleWorkflowStatus, RoleWorkflowMeta> = {
  draft: {
    status: 'draft',
    label: 'Utkast',
    color: '#6b7280',
    order: 0,
    allowedTransitions: ['open', 'cancelled'],
  },
  open: {
    status: 'open',
    label: 'Åpen',
    color: '#00d4ff',
    order: 1,
    allowedTransitions: ['casting', 'cancelled'],
  },
  casting: {
    status: 'casting',
    label: 'Casting pågår',
    color: '#ffb800',
    order: 2,
    allowedTransitions: ['filled', 'cancelled'],
  },
  filled: {
    status: 'filled',
    label: 'Besatt',
    color: '#10b981',
    order: 3,
    allowedTransitions: ['cancelled'],
  },
  cancelled: {
    status: 'cancelled',
    label: 'Kansellert',
    color: '#ef4444',
    order: 4,
    allowedTransitions: [],
  },
};

export const ROLE_WORKFLOW_ORDER: RoleWorkflowStatus[] = [
  'draft',
  'open',
  'casting',
  'filled',
  'cancelled',
];

export function getRoleWorkflowMeta(status: string | undefined | null): RoleWorkflowMeta {
  if (!status || !(status in WORKFLOW)) {
    return WORKFLOW.draft;
  }
  return WORKFLOW[status as RoleWorkflowStatus];
}

export function canTransitionRole(
  fromStatus: string | undefined | null,
  toStatus: string | undefined | null,
): boolean {
  if (!toStatus || !(toStatus in WORKFLOW)) return false;
  const from = getRoleWorkflowMeta(fromStatus);
  return from.allowedTransitions.includes(toStatus as RoleWorkflowStatus);
}
