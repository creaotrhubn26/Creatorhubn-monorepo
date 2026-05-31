import { authSessionService } from '../services/authSessionService';

export function danceAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  return { ...(extra ?? {}), ...authSessionService.getAuthHeadersSync() };
}
