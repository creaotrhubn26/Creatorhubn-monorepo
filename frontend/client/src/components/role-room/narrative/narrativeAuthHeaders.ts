import { authSessionService } from '../services/authSessionService';

export function narrativeAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  return { ...(extra ?? {}), ...authSessionService.getAuthHeadersSync() };
}
