import { useCallback, useState } from 'react';
import {
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
  lastError: { code: string; detail: string } | null;
}

/**
 * Thin hook around postAgentQuery. Keeps a conversation-like history in
 * React state for the Role Room Agent chat panel. This is intentionally
 * minimal — no streaming, no optimistic UI. GDPR pipeline handles the
 * heavy lifting on the backend.
 */
export function useRoleRoomAgentClaude(projectId: string | null): UseRoleRoomAgentClaudeResult {
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [lastError, setLastError] = useState<{ code: string; detail: string } | null>(null);

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
        });
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

  return { messages, pending, send, reset, lastError };
}
