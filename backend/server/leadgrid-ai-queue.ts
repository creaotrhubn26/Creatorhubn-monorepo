/**
 * leadgrid-ai-queue.ts
 *
 * In-process bounded queue for AI-kall (Claude + Whisper + OpenAI).
 * Beskytter mot rate-limit-feil og kost-eksplosjon.
 *
 * Per-provider buckets:
 *   - claude: 30 RPM global (Anthropic tier-1 limit)
 *   - openai_whisper: 30 RPM (Whisper-1 tier-1)
 *   - openai_chat: 50 RPM
 *
 * Per-org override-tak (default 10 RPM per org).
 *
 * Designvalg:
 *   - 60s rullende minutt-vindu per provider og per (provider, org).
 *   - Når kvote-grense treffes, blokkeres acquire i en intern wait-queue
 *     som drainer hver gang en release frigjør plass.
 *   - Tidsbasert «kicker» (setTimeout(..., 1000)) i drain sikrer at
 *     pending kallere blir vekket selv hvis ingen aktive calls slipper
 *     dem fri innen vinduet utløper.
 *   - Med `withAIQuota`-helper trenger callere ikke håndtere
 *     acquire/release manuelt.
 *
 * NB: Dette er per-prosess. Når backend skaleres til flere instanser
 * må vi flytte counter til Redis. RPM-tak settes konservativt slik at
 * 2-3 instanser fortsatt holder seg under Anthropic tier-1.
 */

export type AIProvider = "claude" | "openai_whisper" | "openai_chat";

interface ProviderConfig {
  globalRPM: number;
  perOrgRPM: number;
  maxConcurrent: number;
}

const PROVIDER_CONFIG: Record<AIProvider, ProviderConfig> = {
  claude: { globalRPM: 30, perOrgRPM: 10, maxConcurrent: 5 },
  openai_whisper: { globalRPM: 30, perOrgRPM: 10, maxConcurrent: 3 },
  openai_chat: { globalRPM: 50, perOrgRPM: 20, maxConcurrent: 5 },
};

interface RateState {
  windowStart: number;  // ms timestamp av minute-vinduets start
  count: number;        // antall calls i nåværende minute-vindu
  inFlight: number;     // antall samtidige in-flight
}

interface WaitItem {
  provider: AIProvider;
  orgId: string | null;
  resolve: () => void;
}

class AIQueue {
  private globalState: Record<AIProvider, RateState> = {
    claude: { windowStart: 0, count: 0, inFlight: 0 },
    openai_whisper: { windowStart: 0, count: 0, inFlight: 0 },
    openai_chat: { windowStart: 0, count: 0, inFlight: 0 },
  };
  private orgState: Map<string, RateState> = new Map();
  // Backpressure: pending callers venter til vinduet åpner
  private waitQueue: WaitItem[] = [];
  private drainTimer: NodeJS.Timeout | null = null;

  /**
   * Acquire a slot for an AI-call. Blokker til quota tillater det.
   * Returnerer en release-function du MÅ kalle etter API-kallet
   * (også ved exception).
   */
  async acquire(provider: AIProvider, orgId: string | null = null): Promise<() => void> {
    return new Promise((resolve) => {
      const tryProceed = (): void => {
        const release = this.tryAcquireSlot(provider, orgId);
        if (release) {
          resolve(release);
        } else {
          // Reque — vil bli forsøkt igjen ved drainWaitQueue / kicker
          this.waitQueue.push({ provider, orgId, resolve: tryProceed });
          this.scheduleKicker();
        }
      };
      tryProceed();
    });
  }

  /**
   * Forsøk å reservere en slot synkront. Returnerer en release-funksjon
   * hvis vellykket, ellers null.
   */
  private tryAcquireSlot(provider: AIProvider, orgId: string | null): (() => void) | null {
    const cfg = PROVIDER_CONFIG[provider];
    const now = Date.now();
    const gs = this.globalState[provider];
    if (now - gs.windowStart > 60_000) {
      gs.windowStart = now;
      gs.count = 0;
    }

    let os: RateState | undefined;
    if (orgId) {
      const key = `${provider}:${orgId}`;
      os = this.orgState.get(key);
      if (!os) {
        os = { windowStart: now, count: 0, inFlight: 0 };
        this.orgState.set(key, os);
      }
      if (now - os.windowStart > 60_000) {
        os.windowStart = now;
        os.count = 0;
      }
    }

    const globalOk = gs.count < cfg.globalRPM && gs.inFlight < cfg.maxConcurrent;
    const orgOk = !os || os.count < cfg.perOrgRPM;
    if (!globalOk || !orgOk) return null;

    gs.count++;
    gs.inFlight++;
    if (os) {
      os.count++;
      os.inFlight++;
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;
      gs.inFlight = Math.max(0, gs.inFlight - 1);
      if (os) os.inFlight = Math.max(0, os.inFlight - 1);
      this.drainWaitQueue();
    };
  }

  /**
   * Prøv waitQueue-items hver gang noen frigjør slot, eller når
   * kicker-timeren utløper og minutt-vinduet kan ha åpnet seg.
   */
  private drainWaitQueue(): void {
    const pending = this.waitQueue;
    this.waitQueue = [];
    for (const item of pending) item.resolve();
  }

  /**
   * Sett opp tidsbasert «kicker» som drainer waitQueue periodisk slik
   * at pending kallere ikke blir hengende når minutt-vinduet ruller
   * over uten at noen aktiv call slipper dem fri.
   */
  private scheduleKicker(): void {
    if (this.drainTimer || this.waitQueue.length === 0) return;
    this.drainTimer = setTimeout(() => {
      this.drainTimer = null;
      if (this.waitQueue.length > 0) {
        this.drainWaitQueue();
      }
    }, 1000);
    // Ikke hold prosessen åpen pga. timeren
    if (this.drainTimer && typeof this.drainTimer.unref === "function") {
      this.drainTimer.unref();
    }
  }

  /** For observability — eksponer current state */
  snapshot(): {
    config: Record<AIProvider, ProviderConfig>;
    global: Record<AIProvider, RateState>;
    orgs: number;
    pending: number;
  } {
    return {
      config: PROVIDER_CONFIG,
      global: {
        claude: { ...this.globalState.claude },
        openai_whisper: { ...this.globalState.openai_whisper },
        openai_chat: { ...this.globalState.openai_chat },
      },
      orgs: this.orgState.size,
      pending: this.waitQueue.length,
    };
  }
}

export const aiQueue = new AIQueue();

/**
 * Convenience wrapper. Bruk slik:
 *
 *   const result = await withAIQuota("claude", orgId, async () => {
 *     return client.messages.create({...});
 *   });
 *
 * Release skjer i finally slik at slot frigjøres også ved exception.
 */
export async function withAIQuota<T>(
  provider: AIProvider,
  orgId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  const release = await aiQueue.acquire(provider, orgId);
  try {
    return await fn();
  } finally {
    release();
  }
}
