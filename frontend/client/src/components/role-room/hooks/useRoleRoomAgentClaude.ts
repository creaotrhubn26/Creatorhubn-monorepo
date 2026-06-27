import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getAgentThread,
  postAgentQuery,
  RoleRoomAgentClaudeError,
  streamAgentQuery,
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
    options?: {
      scope?: RoleRoomAgentScope;
      context?: RoleRoomAgentContext;
      stream?: boolean;
    },
  ) => Promise<RoleRoomAgentResponse | null>;
  reset: () => void;
  threadId: string | null;
  loadThread: (threadId: string) => Promise<void>;
  startNewThread: () => void;
  lastError: { code: string; detail: string } | null;
  streaming: boolean;
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
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // `send` is memoized on [projectId] only (so an in-flight stream isn't torn
  // down every time threadId changes). It therefore can't read threadId from
  // closure — that value would be frozen at null and every turn would start a
  // brand-new thread, fragmenting the conversation. Read the live value from
  // this ref instead, kept in sync with the threadId state below.
  const threadIdRef = useRef<string | null>(threadId);
  useEffect(() => {
    threadIdRef.current = threadId;
  }, [threadId]);

  // Abort any in-flight stream when the panel unmounts or the project
  // changes. Without this the fetch keeps running detached, deltas keep
  // calling setState on a gone component, and the stream races against the
  // next project's conversation.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [projectId]);

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
      options?: {
        scope?: RoleRoomAgentScope;
        context?: RoleRoomAgentContext;
        stream?: boolean;
      },
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
      const useStream = options?.stream !== false;

      if (useStream) {
        // Streaming path: append an assistant-placeholder message and mutate
        // its text as deltas arrive. On done, set the full response.
        const assistantId = `a-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: 'assistant',
            text: '',
            createdAt: new Date().toISOString(),
          },
        ]);
        setStreaming(true);
        const controller = new AbortController();
        abortRef.current = controller;
        // Tool_use events arrive between deltas and `done`; collect them so
        // both the per-message response *and* the running confirmation
        // dialogs see the same set.
        const collectedTools: RoleRoomAgentResponse['toolUses'] = [];
        try {
          let finalResponse: RoleRoomAgentResponse | null = null;
          await streamAgentQuery(
            {
              projectId,
              userMessage: userMessage.trim(),
              requiredScope: options?.scope,
              context: options?.context,
              threadId: threadIdRef.current,
            },
            {
              onStart: (payload) => {
                if (payload.threadId && payload.threadId !== threadIdRef.current) {
                  threadIdRef.current = payload.threadId;
                  setThreadId(payload.threadId);
                  writeStoredThreadId(projectId, payload.threadId);
                }
              },
              onDelta: (chunk) => {
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, text: m.text + chunk } : m)),
                );
              },
              onToolUse: (tool) => {
                // Dedupe by id in case the backend emits the same tool
                // both as a `tool_use` event and inside `done.toolUses`.
                if (!collectedTools.some((t) => t.id === tool.id)) {
                  collectedTools.push(tool);
                }
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantId) return m;
                    const existing = m.response;
                    const merged = existing
                      ? { ...existing, toolUses: [...collectedTools] }
                      : undefined;
                    return merged ? { ...m, response: merged } : m;
                  }),
                );
              },
              onDone: (payload) => {
                // The thread id can first appear in `done` (e.g. when the
                // backend creates the row only after a successful turn), so
                // capture it here too — otherwise the next message would
                // start a new thread.
                if (payload.threadId && payload.threadId !== threadIdRef.current) {
                  threadIdRef.current = payload.threadId;
                  setThreadId(payload.threadId);
                  writeStoredThreadId(projectId, payload.threadId);
                }
                // Merge tool_uses from the done payload (authoritative)
                // with anything we already collected from streaming events.
                for (const tool of payload.toolUses ?? []) {
                  if (!collectedTools.some((t) => t.id === tool.id)) {
                    collectedTools.push(tool);
                  }
                }
                // Build a minimal RoleRoomAgentResponse so the UI can render
                // the transparency banner. Cached/non-cached token fields
                // are approximations from the stream payload.
                finalResponse = {
                  text: '', // filled below from accumulated
                  toolUses: [...collectedTools],
                  model: payload.model,
                  latencyMs: 0,
                  usage: {
                    inputTokens: payload.usage.inputTokens,
                    outputTokens: payload.usage.outputTokens,
                  },
                  consentId: '',
                  threadId: payload.threadId ?? null,
                  transparency: payload.transparency,
                };
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantId) return m;
                    const completeResponse = finalResponse
                      ? { ...finalResponse, text: m.text }
                      : undefined;
                    return { ...m, response: completeResponse };
                  }),
                );
              },
              onError: (message) => {
                setLastError({ code: 'stream_error', detail: message });
                // An `error` SSE event (as opposed to a thrown/HTTP error)
                // doesn't reject the stream promise, so without this the
                // assistant placeholder would stay blank with no explanation.
                // Only stamp the error when no text streamed in yet, so a
                // late error doesn't wipe a partial-but-useful answer.
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId && !m.text
                      ? { ...m, error: message }
                      : m,
                  ),
                );
              },
            },
            controller.signal,
          );
          return finalResponse;
        } catch (err) {
          // The stream was deliberately aborted (panel closed / project
          // switched mid-stream). That's not an error to surface — drop the
          // dangling placeholder and bail quietly.
          if (
            controller.signal.aborted ||
            (err instanceof DOMException && err.name === 'AbortError')
          ) {
            setMessages((prev) => prev.filter((m) => m.id !== assistantId));
            return null;
          }
          if (err instanceof RoleRoomAgentClaudeError) {
            setLastError({ code: err.code, detail: err.detail });
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, error: err.detail, text: '' } : m,
              ),
            );
            // If the stream endpoint refuses (e.g. agent disabled), fall
            // back to the non-streaming endpoint so the user still gets an
            // answer where possible.
            if (err.code === 'agent_disabled' || err.httpStatus === 404) {
              try {
                const fallback = await postAgentQuery({
                  projectId,
                  userMessage: userMessage.trim(),
                  requiredScope: options?.scope,
                  context: options?.context,
                  threadId: threadIdRef.current,
                });
                if (fallback.threadId && fallback.threadId !== threadIdRef.current) {
                  threadIdRef.current = fallback.threadId;
                  setThreadId(fallback.threadId);
                  writeStoredThreadId(projectId, fallback.threadId);
                }
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          error: undefined,
                          text: fallback.text,
                          response: fallback,
                        }
                      : m,
                  ),
                );
                return fallback;
              } catch {
                /* already surfaced */
              }
            }
          } else {
            setLastError({
              code: 'unknown',
              detail: err instanceof Error ? err.message : String(err),
            });
          }
          return null;
        } finally {
          setStreaming(false);
          setPending(false);
          abortRef.current = null;
        }
      }

      try {
        const response = await postAgentQuery({
          projectId,
          userMessage: userMessage.trim(),
          requiredScope: options?.scope,
          context: options?.context,
          threadId: threadIdRef.current,
        });
        if (response.threadId && response.threadId !== threadIdRef.current) {
          threadIdRef.current = response.threadId;
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
    threadIdRef.current = null;
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
      threadIdRef.current = nextThreadId;
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

  return { messages, pending, send, reset, threadId, loadThread, startNewThread, lastError, streaming };
}
