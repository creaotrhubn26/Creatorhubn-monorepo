/**
 * Short Duration Formatter
 * Formats durations into Norwegian short form (t = timer, m = minutter, s = sekunder)
 */

export function formatShortDuration(seconds: number): string {
  if (!seconds || seconds <= 0) {
    return '0s';
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}t ${minutes}m`;
    }
    return `${hours}t`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${secs}s`;
}
