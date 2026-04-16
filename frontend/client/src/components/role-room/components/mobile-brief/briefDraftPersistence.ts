/**
 * Per-project draft persistence for the mobile brief wizard.
 *
 * Backlog item 104: "La klienten lagre brief-utkast per steg på mobil."
 * We also use the draft to absorb the "unsaved edits during a reload"
 * scenario — when a user returns to the wizard, any local-only fields are
 * merged on top of the server intake.
 */

import type { ProducerClientIntake } from '../../models/casting';

const DRAFT_KEY_PREFIX = 'role-room:mobile:brief-draft:';

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readBriefDraft(projectId: string): Partial<ProducerClientIntake> | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(DRAFT_KEY_PREFIX + projectId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as Partial<ProducerClientIntake>;
  } catch {
    return null;
  }
}

export function writeBriefDraft(projectId: string, draft: Partial<ProducerClientIntake>): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(DRAFT_KEY_PREFIX + projectId, JSON.stringify(draft));
  } catch {
    /* ignore quota errors */
  }
}

export function clearBriefDraft(projectId: string): void {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(DRAFT_KEY_PREFIX + projectId);
  } catch {
    /* ignore */
  }
}
