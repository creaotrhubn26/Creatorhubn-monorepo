/**
 * Enkel, prosess-lokal rate-limit for Story Graphs offentlige token-ruter (Fase 8a).
 *
 * Nøkkelen er en hash av tokenet — ikke IP: backend står bak Renders proxy uten
 * `trust proxy`, så `req.ip` er lik for alle klienter og ville gitt én global bøtte.
 * Per-token-budsjett er det som faktisk beskytter en delingslenke mot skraping,
 * og det er mønsteret repoet alt bruker for deltakerdokumenter
 * (`workspace-participant-documents-routes.ts`). Ingen ekstern avhengighet.
 */
import { createHash } from 'node:crypto';

export interface TokenRateLimiter {
  /** true = over grensen (kalleren svarer 429). */
  hit(key: string, now?: number): boolean;
  /** Antall nøkler i minnet (til test/observasjon). */
  size(): number;
}

export function createTokenRateLimiter(opts: { windowMs: number; max: number; maxKeys?: number }): TokenRateLimiter {
  const windowMs = Math.max(1000, opts.windowMs);
  const max = Math.max(1, opts.max);
  const maxKeys = Math.max(100, opts.maxKeys ?? 10_000);
  const buckets = new Map<string, { count: number; resetAt: number }>();

  const sweep = (now: number) => {
    if (buckets.size < maxKeys) return;
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    // Fortsatt fullt (angrep med ferske tokens): dropp de eldste så minnet er avgrenset.
    if (buckets.size >= maxKeys) {
      const drop = buckets.size - Math.floor(maxKeys * 0.9);
      let n = 0;
      for (const k of buckets.keys()) { if (n++ >= drop) break; buckets.delete(k); }
    }
  };

  return {
    hit(key, now = Date.now()) {
      const hashed = createHash('sha256').update(key, 'utf8').digest('hex');
      const cur = buckets.get(hashed);
      if (!cur || cur.resetAt <= now) {
        sweep(now);
        buckets.set(hashed, { count: 1, resetAt: now + windowMs });
        return false;
      }
      cur.count += 1;
      return cur.count > max;
    },
    size: () => buckets.size,
  };
}
