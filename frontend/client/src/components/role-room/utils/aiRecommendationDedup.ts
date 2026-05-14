/**
 * Persistens for AI-anbefaling-dedup. Hver anbefaling identifiseres med
 * en stabil `recommendationId`. Etter at en bruker har sett anbefalingen
 * én gang markerer vi den som "sett" i localStorage så den ikke dukker
 * opp igjen.
 *
 * Brukes også som infrastruktur for senere onboarding-tour, der hvert
 * tour-steg får sin egen recommendationId.
 */

const STORAGE_KEY_PREFIX = 'ai-rec-seen:';

function buildKey(recommendationId: string, userKey: string | null | undefined): string {
  const normalizedId = recommendationId.trim();
  if (!normalizedId) {
    throw new Error('recommendationId må være en ikke-tom streng');
  }
  const normalizedUser = String(userKey ?? '').trim();
  return normalizedUser
    ? `${STORAGE_KEY_PREFIX}${normalizedUser}:${normalizedId}`
    : `${STORAGE_KEY_PREFIX}${normalizedId}`;
}

export interface AIRecommendationDedupAdapter {
  hasSeen: (recommendationId: string) => boolean;
  markSeen: (recommendationId: string) => void;
  forget: (recommendationId: string) => void;
  forgetAll: () => void;
}

export interface DedupAdapterOptions {
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
  userKey?: string | null;
}

export function createAIRecommendationDedupAdapter(
  options: DedupAdapterOptions = {},
): AIRecommendationDedupAdapter {
  const storage = options.storage ?? (typeof window !== 'undefined' ? window.localStorage : null);

  if (!storage) {
    // SSR / no-storage fallback — no-op so we don't crash.
    return {
      hasSeen: () => false,
      markSeen: () => {},
      forget: () => {},
      forgetAll: () => {},
    };
  }

  return {
    hasSeen: (recommendationId) => {
      try {
        return storage.getItem(buildKey(recommendationId, options.userKey)) !== null;
      } catch {
        return false;
      }
    },
    markSeen: (recommendationId) => {
      try {
        storage.setItem(
          buildKey(recommendationId, options.userKey),
          new Date().toISOString(),
        );
      } catch {
        /* storage full — fail silent */
      }
    },
    forget: (recommendationId) => {
      try {
        storage.removeItem(buildKey(recommendationId, options.userKey));
      } catch {
        /* ignore */
      }
    },
    forgetAll: () => {
      try {
        const userPrefix = options.userKey
          ? `${STORAGE_KEY_PREFIX}${String(options.userKey).trim()}:`
          : STORAGE_KEY_PREFIX;
        const toRemove: string[] = [];
        for (let i = 0; i < storage.length; i += 1) {
          const key = storage.key(i);
          if (key && key.startsWith(userPrefix)) {
            toRemove.push(key);
          }
        }
        toRemove.forEach((key) => storage.removeItem(key));
      } catch {
        /* ignore */
      }
    },
  };
}
