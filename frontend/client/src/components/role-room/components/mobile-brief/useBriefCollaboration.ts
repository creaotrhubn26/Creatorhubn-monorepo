/**
 * useBriefCollaboration — felles state for kommentarer per brief-felt og
 * activity-feeden. En instans per (projectId, fieldKey?).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  briefCollaborationService,
  type BriefComment,
  type BriefActivityEntry,
} from '../../services/briefCollaborationService';

interface UseBriefCommentsResult {
  comments: BriefComment[];
  loading: boolean;
  error: string | null;
  addComment: (body: string, opts?: { parentId?: string; authorName?: string }) => Promise<BriefComment>;
  resolveComment: (commentId: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  reload: () => Promise<void>;
}

export function useBriefComments(
  projectId: string | null,
  fieldKey: string | null,
): UseBriefCommentsResult {
  const [comments, setComments] = useState<BriefComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    if (!projectId || !fieldKey) {
      setComments([]);
      return;
    }
    const id = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const list = await briefCollaborationService.listComments(projectId, { fieldKey });
      if (id !== requestIdRef.current) return;
      setComments(list);
    } catch (err) {
      if (id !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Kunne ikke hente kommentarer');
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [projectId, fieldKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addComment = useCallback(
    async (body: string, opts: { parentId?: string; authorName?: string } = {}) => {
      if (!projectId || !fieldKey) throw new Error('Mangler projectId/fieldKey');
      const created = await briefCollaborationService.addComment(projectId, {
        fieldKey,
        body,
        parentId: opts.parentId,
        authorName: opts.authorName,
      });
      setComments((prev) => [...prev, created]);
      return created;
    },
    [projectId, fieldKey],
  );

  const resolveComment = useCallback(
    async (commentId: string) => {
      if (!projectId) return;
      const updated = await briefCollaborationService.resolveComment(projectId, commentId);
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
    },
    [projectId],
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      if (!projectId) return;
      await briefCollaborationService.deleteComment(projectId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    },
    [projectId],
  );

  return { comments, loading, error, addComment, resolveComment, deleteComment, reload };
}

interface UseBriefActivityResult {
  activity: BriefActivityEntry[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useBriefActivity(projectId: string | null, limit = 50): UseBriefActivityResult {
  const [activity, setActivity] = useState<BriefActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!projectId) {
      setActivity([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await briefCollaborationService.listActivity(projectId, limit);
      setActivity(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke hente activity');
    } finally {
      setLoading(false);
    }
  }, [projectId, limit]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { activity, loading, error, reload };
}
