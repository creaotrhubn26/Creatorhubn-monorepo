export type RecallStatus = 'todo' | 'in_progress' | 'done';

export interface RecallSourceComment {
  id: string;
  body?: string | null;
  section_ref?: string | null;
  timecode_seconds?: number | string | null;
}

export const nextRecallStatus = (status: string): RecallStatus => {
  if (status === 'todo') return 'in_progress';
  if (status === 'in_progress') return 'done';
  return 'todo';
};

export const recallTitleFromComment = (comment: RecallSourceComment): string => {
  const compact = String(comment.body || '')
    .replace(/\s+/g, ' ')
    .trim();
  return compact.length > 180 ? `${compact.slice(0, 177).trimEnd()}…` : compact;
};

export function recallPayloadFromComment(
  projectId: string,
  versionId: string,
  comment: RecallSourceComment,
): Record<string, string> {
  return {
    projectId,
    versionId,
    commentId: comment.id,
    title: recallTitleFromComment(comment),
    assignee: String(comment.section_ref || 'Recall'),
    status: 'todo',
  };
}
