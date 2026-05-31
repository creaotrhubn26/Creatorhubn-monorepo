/**
 * Match en oppdaget volum-kapasitet (bytes) mot wizardens planlagte
 * minnekort. SD/CF-kort merkes typisk "64GB" men brutto-kapasitet etter
 * FS-overhead ligger 5-12 % under. Vi avgjør match ved nærmeste
 * standard-bøtte (32/64/128/256/512/1024 GB) innenfor ±15 %.
 */

const STANDARD_BUCKETS_GB = [16, 32, 64, 128, 256, 512, 1024, 2048];

export function bytesToHumanGb(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "?";
  const gb = bytes / 1_000_000_000;
  return gb >= 100 ? `${gb.toFixed(0)} GB` : `${gb.toFixed(1)} GB`;
}

/**
 * Returnerer den standard-bøtten oppgitt kapasitet er nærmest, eller null
 * hvis ingenting matcher innenfor ±15 %.
 */
export function nearestStandardGb(bytes: number | null | undefined): number | null {
  if (!bytes || bytes <= 0) return null;
  const gb = bytes / 1_000_000_000;
  let best: { bucket: number; delta: number } | null = null;
  for (const bucket of STANDARD_BUCKETS_GB) {
    const delta = Math.abs(bucket - gb) / bucket;
    if (delta <= 0.15 && (!best || delta < best.delta)) {
      best = { bucket, delta };
    }
  }
  return best ? best.bucket : null;
}

/**
 * Parser en label som "64GB", "1TB", "128 GB" til et tall i GB.
 * Returnerer null hvis ikke parsbar.
 */
export function parseCapacityLabelGb(label: string | undefined): number | null {
  if (!label) return null;
  const m = label.trim().toUpperCase().match(/^(\d+(?:\.\d+)?)\s*(TB|GB|MB)?$/);
  if (!m) return null;
  const value = parseFloat(m[1]);
  const unit = m[2] || "GB";
  if (unit === "TB") return value * 1024;
  if (unit === "MB") return value / 1024;
  return value;
}
