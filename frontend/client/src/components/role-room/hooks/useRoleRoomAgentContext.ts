/**
 * useRoleRoomAgentContext — assembles the RoleRoomAgentContext payload
 * from the project's existing hooks. Parent components call this, then
 * pass `context` down to RoleRoomAgentChatPanel.
 *
 * We deliberately send small, high-signal slices:
 *   - openReviews: the 10 most recent non-terminal reviews
 *   - timelineHighlights: up to 20 items due in the next 30 days or
 *     currently blocked
 *   - candidates / crew: first 30 of each (backend re-filters via
 *     consent excludedEntityIds)
 *
 * Large payloads explode the prompt-cache cost budget; small ones miss
 * signal. 30/20/10 was picked as a starting compromise — adjust after
 * real usage data.
 */

import { useMemo } from 'react';
import { useProducerReviews } from './useProducerReviews';
import { useProducerTimeline } from './useProducerTimeline';
import { useClientIntake } from './useClientIntake';
import { useShootingDays } from './useShootingDays';
import { useProducerEconomy } from './useProducerEconomy';
import type { RoleRoomAgentContext } from '../services/roleRoomAgentClaudeApi';

const MAX_REVIEWS = 10;
const MAX_TIMELINE = 20;
const MAX_CANDIDATES = 30;
const MAX_CREW = 30;
const MAX_SHOOTING_DAYS = 10;
const MAX_ECONOMY_ITEMS = 25;
const TIMELINE_HORIZON_MS = 30 * 24 * 60 * 60 * 1000;
const SHOOTING_DAY_HORIZON_MS = 14 * 24 * 60 * 60 * 1000;

export interface UseRoleRoomAgentContextInput {
  projectId: string | null;
  candidates?: Array<{ id: string; full_name?: string | null; email?: string | null; phone?: string | null }>;
  crew?: Array<{ id: string; name?: string | null; email?: string | null; phone?: string | null; role?: string | null }>;
}

export function useRoleRoomAgentContext({
  projectId,
  candidates,
  crew,
}: UseRoleRoomAgentContextInput): RoleRoomAgentContext {
  const { items: reviewItems } = useProducerReviews(projectId ?? undefined);
  const { items: timelineItems } = useProducerTimeline(projectId ?? undefined);
  const { intake } = useClientIntake(projectId ?? undefined);
  const { items: shootingDayItems } = useShootingDays(projectId ?? undefined);
  const { items: economyItemsRaw } = useProducerEconomy(projectId ?? undefined);

  return useMemo<RoleRoomAgentContext>(() => {
    const briefSummary = intake
      ? [
          intake.projectGoal ? `Mål: ${intake.projectGoal}` : null,
          intake.targetAudience ? `Målgruppe: ${intake.targetAudience}` : null,
          intake.deliverables ? `Leveranser: ${intake.deliverables}` : null,
          intake.timingConstraints ? `Tidsrammer: ${intake.timingConstraints}` : null,
          intake.brandNotes ? `Merkevare: ${intake.brandNotes}` : null,
        ]
          .filter(Boolean)
          .join('\n') || undefined
      : undefined;

    const openReviews = (reviewItems ?? [])
      .filter((r: any) => r.status !== 'approved' && r.status !== 'rejected')
      .slice(0, MAX_REVIEWS)
      .map((r: any) => ({ id: r.id, title: r.title, status: r.status }));

    const now = Date.now();
    const horizon = now + TIMELINE_HORIZON_MS;
    const timelineHighlights = (timelineItems ?? [])
      .filter((item: any) => {
        if (item.status === 'blocked') return true;
        if (item.status === 'completed') return false;
        if (!item.due_at) return false;
        const due = new Date(item.due_at).getTime();
        if (Number.isNaN(due)) return false;
        return due >= now - 24 * 60 * 60 * 1000 && due <= horizon;
      })
      .sort((a: any, b: any) => {
        const aT = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER;
        const bT = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER;
        return aT - bT;
      })
      .slice(0, MAX_TIMELINE)
      .map((item: any) => ({
        id: item.id,
        title: item.title,
        phase: item.phase,
        status: item.status,
        dueAt: item.due_at ?? null,
      }));

    const candidatesOut = (candidates ?? [])
      .slice(0, MAX_CANDIDATES)
      .map((c) => ({
        id: c.id,
        name: c.full_name ?? null,
        email: c.email ?? null,
        phone: c.phone ?? null,
      }));

    const crewOut = (crew ?? [])
      .slice(0, MAX_CREW)
      .map((c: any) => ({
        id: c.id,
        name: c.name ?? null,
        email: c.email ?? null,
        phone: c.phone ?? null,
        role: c.role ?? null,
      }));

    // Shooting days: today + next 14 d + anything still in-progress/planned
    // with a date in the last 3 days so the agent can reference "yesterday's
    // shoot" in follow-up questions.
    const nowMs = Date.now();
    const shootHorizon = nowMs + SHOOTING_DAY_HORIZON_MS;
    const recentShootFloor = nowMs - 3 * 24 * 60 * 60 * 1000;
    const shootingDays = (shootingDayItems ?? [])
      .filter((day: any) => {
        const t = day?.date ? new Date(day.date).getTime() : NaN;
        if (Number.isNaN(t)) return false;
        if (day.status === 'in-progress' || day.status === 'planned') {
          return t >= recentShootFloor && t <= shootHorizon;
        }
        if (day.status === 'wrapped') {
          return t >= recentShootFloor;
        }
        return false;
      })
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, MAX_SHOOTING_DAYS)
      .map((day: any) => ({
        id: day.id,
        dayNumber: day.dayNumber ?? 0,
        date: day.date,
        callTime: day.callTime ?? null,
        wrapTime: day.wrapTime ?? null,
        location: day.location ?? null,
        status: day.status,
        weather: day.weather
          ? { condition: day.weather.condition, temperature: day.weather.temperature }
          : null,
      }));

    // Economy: prioritise blocked + items with actual > approved (overspend
    // signals) + anything pending approval. Everything else fills up to
    // MAX_ECONOMY_ITEMS, with approved/completed items last.
    const economyItems = (economyItemsRaw ?? [])
      .slice()
      .sort((a: any, b: any) => {
        const priority = (item: any) => {
          if (item.status === 'blocked') return 0;
          const actual = Number(item.actual ?? 0);
          const approved = Number(item.approved ?? 0);
          if (!Number.isNaN(actual) && !Number.isNaN(approved) && actual > approved) return 1;
          if (item.status === 'pending_approval') return 2;
          if (item.status === 'approved') return 3;
          return 4;
        };
        return priority(a) - priority(b);
      })
      .slice(0, MAX_ECONOMY_ITEMS)
      .map((item: any) => ({
        id: item.id,
        phase: item.phase,
        category: item.category,
        itemName: item.item_name,
        estimate: item.estimate ?? null,
        approved: item.approved ?? null,
        actual: item.actual ?? null,
        currency: item.currency,
        status: item.status,
        clientVisible: item.client_visible,
      }));

    return {
      briefSummary,
      openReviews: openReviews.length > 0 ? openReviews : undefined,
      timelineHighlights: timelineHighlights.length > 0 ? timelineHighlights : undefined,
      candidates: candidatesOut.length > 0 ? candidatesOut : undefined,
      crew: crewOut.length > 0 ? crewOut : undefined,
      shootingDays: shootingDays.length > 0 ? shootingDays : undefined,
      economyItems: economyItems.length > 0 ? economyItems : undefined,
    };
  }, [intake, reviewItems, timelineItems, candidates, crew, shootingDayItems, economyItemsRaw]);
}
