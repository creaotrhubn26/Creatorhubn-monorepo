import { useCallback, useEffect, useState } from 'react';
import {
  getAgentThread,
  postAgentQuery,
  RoleRoomAgentClaudeError,
  type RoleRoomAgentContext,
  type RoleRoomAgentResponse,
  type RoleRoomAgentScope,
} from '../services/roleRoomAgentClaudeApi';

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  response?: RoleRoomAgentResponse;
  error?: string;
  createdAt: string;
}

export interface UseRoleRoomAgentClaudeResult {
  messages: AgentChatMessage[];
  pending: boolean;
  send: (
    userMessage: string,
    options?: { scope?: RoleRoomAgentScope; context?: RoleRoomAgentContext },
  ) => Promise<RoleRoomAgentResponse | null>;
  reset: () => void;
  threadId: string | null;
  loadThread: (threadId: string) => Promise<void>;
  startNewThread: () => void;
  lastError: { code: string; detail: string } | null;
}

const ACTIVE_THREAD_STORAGE_PREFIX = 'role-room-agent-thread:';

/**
 * Thin hook around postAgentQuery. Keeps a conversation-like history in
 * React state for the Role Room Agent chat panel. This is intentionally
 * minimal — no streaming, no optimistic UI. GDPR pipeline handles the
 * heavy lifting on the backend.
 */
function readStoredThreadId(projectId: string | null): string | null {
  if (!projectId || typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ACTIVE_THREAD_STORAGE_PREFIX + projectId);
  } catch {
    return null;
  }
}

function writeStoredThreadId(projectId: string | null, threadId: string | null): void {
  if (!projectId || typeof window === 'undefined') return;
  try {
    if (threadId) window.localStorage.setItem(ACTIVE_THREAD_STORAGE_PREFIX + projectId, threadId);
    else window.localStorage.removeItem(ACTIVE_THREAD_STORAGE_PREFIX + projectId);
  } catch {
    /* ignore */
  }
}

export function useRoleRoomAgentClaude(projectId: string | null): UseRoleRoomAgentClaudeResult {
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [lastError, setLastError] = useState<{ code: string; detail: string } | null>(null);
  const [threadId, setThreadId] = useState<string | null>(() => readStoredThreadId(projectId));

  // Load the active thread (if any) when the projectId changes, so the user
  // picks up where they left off across sessions.
  useEffect(() => {
    let cancelled = false;
    if (!projectId) {
      setThreadId(null);
      setMessages([]);
      return () => {
        cancelled = true;
      };
    }
    const stored = readStoredThreadId(projectId);
    setThreadId(stored);
    if (!stored) {
      setMessages([]);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      const loaded = await getAgentThread(projectId, stored);
      if (cancelled) return;
      if (!loaded) {
        writeStoredThreadId(projectId, null);
        setThreadId(null);
        setMessages([]);
        return;
      }
      const restored: AgentChatMessage[] = loaded.messages.map((m) => ({
        id: m.id,
        role: m.role === 'system' ? 'assistant' : m.role,
        text: m.text,
        response: m.response ?? undefined,
        createdAt: m.createdAt,
      }));
      setMessages(restored);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const send = useCallback(
    async (
      userMessage: string,
      options?: { scope?: RoleRoomAgentScope; context?: RoleRoomAgentContext },
    ): Promise<RoleRoomAgentResponse | null> => {
      if (!projectId || !userMessage.trim()) return null;
      const userEntry: AgentChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        text: userMessage.trim(),
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userEntry]);
      setPending(true);
      setLastError(null);
      try {
        const response = await postAgentQuery({
          projectId,
          userMessage: userMessage.trim(),
          requiredScope: options?.scope,
          context: options?.context,
          threadId,
        });
        if (response.threadId && response.threadId !== threadId) {
          setThreadId(response.threadId);
          writeStoredThreadId(projectId, response.threadId);
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: response.text,
            response,
            createdAt: new Date().toISOString(),
          },
        ]);
        return response;
      } catch (err) {
        if (err instanceof RoleRoomAgentClaudeError) {
          setLastError({ code: err.code, detail: err.detail });
          setMessages((prev) => [
            ...prev,
            {
              id: `a-err-${Date.now()}`,
              role: 'assistant',
              text: '',
              error: err.detail,
              createdAt: new Date().toISOString(),
            },
          ]);
        } else {
          setLastError({ code: 'unknown', detail: err instanceof Error ? err.message : String(err) });
        }
        return null;
      } finally {
        setPending(false);
      }
    },
    [projectId],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setLastError(null);
  }, []);

  const startNewThread = useCallback(() => {
    setThreadId(null);
    writeStoredThreadId(projectId, null);
    setMessages([]);
    setLastError(null);
  }, [projectId]);

  const loadThread = useCallback(
    async (nextThreadId: string) => {
      if (!projectId) return;
      const loaded = await getAgentThread(projectId, nextThreadId);
      if (!loaded) return;
      setThreadId(nextThreadId);
      writeStoredThreadId(projectId, nextThreadId);
      setMessages(
        loaded.messages.map((m) => ({
          id: m.id,
          role: m.role === 'system' ? 'assistant' : m.role,
          text: m.text,
          response: m.response ?? undefined,
          createdAt: m.createdAt,
        })),
      );
      setLastError(null);
    },
    [projectId],
  );

  return { messages, pending, send, reset, threadId, loadThread, startNewThread, lastError };
}
