/**
 * Deterministisk farge per bruker (samme palett som dance-realtime-server.ts),
 * stabil over reconnects og mellom klienter uten koordinering.
 */

export const PRESENCE_PALETTE = [
  '#a78bfa', '#fbbf24', '#34d399', '#60a5fa',
  '#ec4899', '#f87171', '#06b6d4', '#84cc16',
] as const;

export function pickPresenceColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return PRESENCE_PALETTE[Math.abs(hash) % PRESENCE_PALETTE.length];
}

export function initialsOf(name: string, fallback = '?'): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
