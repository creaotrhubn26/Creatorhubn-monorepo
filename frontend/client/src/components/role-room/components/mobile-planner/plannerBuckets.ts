/**
 * Mobile Planner feed bucketing (backlog items 076, 084, 092, 095).
 *
 * Splits ProducerTimelineItem[] into three visible buckets:
 *   - blockedItems (status === 'blocked', shown first as red/yellow group)
 *   - today        (due today, not completed)
 *   - next         (due within the next 14 days or no date, not completed)
 *
 * Completed items are filtered out — the mobile feed is an "actionable now"
 * surface, not a history log. Drop to desktop for that.
 */

import type { ProducerTimelineItem } from '../../services/producerWorkflowService';

export interface PlannerBuckets {
  blockedItems: ProducerTimelineItem[];
  today: ProducerTimelineItem[];
  next: ProducerTimelineItem[];
  overdue: ProducerTimelineItem[];
}

const DAY_MS = 86_400_000;

export function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function bucketTimeline(items: ProducerTimelineItem[]): PlannerBuckets {
  const todayStart = startOfToday();
  const todayEnd = todayStart + DAY_MS;
  const nextCutoff = todayStart + DAY_MS * 14;

  const blockedItems: ProducerTimelineItem[] = [];
  const today: ProducerTimelineItem[] = [];
  const next: ProducerTimelineItem[] = [];
  const overdue: ProducerTimelineItem[] = [];

  for (const item of items) {
    if (item.status === 'completed') continue;
    if (item.status === 'blocked') {
      blockedItems.push(item);
      continue;
    }
    if (!item.due_at) {
      next.push(item);
      continue;
    }
    const due = new Date(item.due_at).getTime();
    if (Number.isNaN(due)) {
      next.push(item);
      continue;
    }
    if (due < todayStart) {
      overdue.push(item);
    } else if (due < todayEnd) {
      today.push(item);
    } else if (due < nextCutoff) {
      next.push(item);
    } else {
      next.push(item);
    }
  }

  // Within each bucket, earliest due_at first; null last.
  const byDue = (a: ProducerTimelineItem, b: ProducerTimelineItem) => {
    const aT = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER;
    const bT = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER;
    return aT - bT;
  };
  blockedItems.sort(byDue);
  today.sort(byDue);
  next.sort(byDue);
  overdue.sort(byDue);

  return { blockedItems, today, next, overdue };
}

export function phaseProgress(items: ProducerTimelineItem[]) {
  const phases: ('preproduction' | 'production' | 'postproduction')[] = [
    'preproduction',
    'production',
    'postproduction',
  ];
  return phases.map((phase) => {
    const phaseItems = items.filter((item) => item.phase === phase);
    const completed = phaseItems.filter((item) => item.status === 'completed').length;
    return {
      phase,
      total: phaseItems.length,
      completed,
      percent: phaseItems.length === 0 ? 0 : Math.round((completed / phaseItems.length) * 100),
    };
  });
}

export const PHASE_LABELS: Record<string, string> = {
  preproduction: 'Pre',
  production: 'Prod',
  postproduction: 'Post',
};
