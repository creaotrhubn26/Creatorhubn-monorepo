# Markedsinnsikt v1 — Implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deterministiske innsikts-kort som tolker styringsrente, KPI og valutakurs fra offentlige kilder opp mot virksomhetens eget regnskap, vist i Framover og på Oversikt.

**Architecture:** Ny `src/market/`-modul: kilde-porter (fetch + stub, som `fx-rates.ts`) → `signal-store` (persistert i `market_signals`) → ren `engine`-funksjon som kombinerer signaler med org-eksponering (hentet fra hovedboka + Brreg NACE) → `insight_cards`. En token-autentisert cron-rute frisker opp signaler og regenererer kort; en les-rute serverer dem. Ingen KI i v1 — alt er deterministisk og sporbart.

**Tech Stack:** TypeScript (Node ESM), `pg`, Express, Zod, Vitest/bun. Kilder: Norges Bank open API (rente + valuta), SSB PxWebApi (KPI), Brønnøysund Enhetsregisteret (NACE).

## Global Constraints

- **Isolert worktree:** all kode ligger i `~/monorepo-ledgerly/apps/reknaren` på gren `claude/norwegian-accounting-platform-t7w023`. Aldri i hoved-dir (grenen committer selv-refererende `node_modules`-symlink).
- **Migrasjoner kjøres MANUELT mot prod-Neon før deploy** (Render har ingen `preDeployCommand`). Neste ledige nummer: `0022`.
- **Penger er `BIGINT` øre (`amount_minor`), representert som `bigint` i TS.** Aldri flyttall for kroner.
- **Ingen nye avhengigheter.** Bruk `fetch` (global) + eksisterende `pg`/`zod`.
- **Append-vennlig:** `market_signals` og `insight_cards` skrives på nytt/oppdateres, men ikke inne i hovedbok-triggere. Ingen endring av eksisterende append-only-tabeller.
- **Kilde-porter er injiserbare:** hver ekstern kilde har et interface + en `NorgesBank*`/`Ssb*`-klasse + en `Static*Stub` for test (mønster fra `src/integrations/fx-rates.ts`).
- **Norsk kopi** i all brukervendt tekst.
- **Hvert kort bærer kildeattribusjon + «Ikke finansiell rådgivning».** Ingen personlig investeringsrådgivning. Ingen lagring/visning av full artikkeltekst (ikke relevant i v1 — ingen nyhetskilder ennå).
- **Verifiser med full `tsc --noEmit`** (ikke grep/timeout) etter hver task; forvent 0 nye feil i egne filer.
- **Testkjøring:** `~/.bun/bin/bun run test <fil>`. pg-tester krever lokal Postgres `reknaren_test` (`postgres://reknaren:reknaren_dev@localhost:5432/reknaren_test`).

---

## Filstruktur

| Fil | Ansvar |
|---|---|
| `migrations/0022_market_insight.sql` | `market_signals` + `insight_cards`-tabeller |
| `src/market/signal-store.ts` | Persister/les signaler (siste + forrige per nøkkel) |
| `src/market/sources/policy-rate.ts` | Norges Bank styringsrente (port + stub) |
| `src/market/sources/kpi.ts` | SSB KPI 12-mnd endring (port + stub) |
| `src/market/exposure.ts` | Org-eksponering fra hovedbok + NACE fra Brreg |
| `src/market/engine.ts` | Ren regel-motor: signaler + eksponering → kort |
| `src/market/refresh.ts` | Orkestrering: frisk opp signaler + regenerer kort |
| `src/integrations/company-registry.ts` | *(modifiser)* legg til `naceCode` i `CompanyProfile` |
| `src/api/server.ts` | *(modifiser)* cron-rute + les-rute |
| `src/api/main.ts` | *(modifiser)* instansier kilder + injiser |
| `web/src/screens.tsx` | *(modifiser)* `MarketInsightCard` + «Verdt å vite»-panel |
| `web/src/styles.css` | *(modifiser)* `.icard`-stiler |
| `test/market-*.ts` | Tester per modul |

---

### Task 1: Migrasjon — market_signals + insight_cards

**Files:**
- Create: `migrations/0022_market_insight.sql`
- Test: `test/market-migration.pg.test.ts`

**Interfaces:**
- Produces: tabellene `market_signals(source, kind, signal_key, value_num, unit, period, published_at, url, raw, observed_at)` og `insight_cards(id, organization_id, kind, title, body, impact_minor, direction, signal_refs, sources, valid_until, dismissed_at, created_at)`.

- [ ] **Step 1: Skriv migrasjonen**

```sql
-- Markedssignaler (offentlige tall) + genererte innsikts-kort per virksomhet.
-- market_signals er global (ikke org-spesifikk): ett sett tall alle deler.
-- insight_cards er per-org: motoren tolker signalene mot virksomhetens tall.

CREATE TABLE market_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,                 -- 'norges_bank' | 'ssb'
  kind TEXT NOT NULL,                   -- 'policy_rate' | 'kpi_yoy' | 'fx_rate'
  signal_key TEXT NOT NULL,             -- f.eks. 'KPRA', 'KPI', 'EUR'
  value_num NUMERIC NOT NULL,           -- rå verdi (prosent eller kurs)
  unit TEXT NOT NULL,                   -- 'percent' | 'nok_per_unit'
  period TEXT NOT NULL,                 -- ISO-dato eller 'YYYY-MM' som verdien gjelder
  published_at TIMESTAMPTZ,
  url TEXT,
  raw JSONB,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, kind, signal_key, period)
);
CREATE INDEX market_signals_key_idx ON market_signals (kind, signal_key, period DESC);

CREATE TABLE insight_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  kind TEXT NOT NULL,                   -- regel-id, f.eks. 'rate_debt'
  severity TEXT NOT NULL CHECK (severity IN ('signal','opportunity','watch')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  impact_minor BIGINT,                  -- kroner-effekt (kan være null for rene signal)
  direction TEXT CHECK (direction IN ('cost','benefit','neutral')),
  signal_refs JSONB NOT NULL DEFAULT '[]',  -- [{kind, signal_key, period}]
  sources JSONB NOT NULL DEFAULT '[]',      -- [{label, url}]
  valid_until TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, kind)        -- ett aktivt kort per regel per org; regen overskriver
);
CREATE INDEX insight_cards_org_idx ON insight_cards (organization_id, dismissed_at);
```

- [ ] **Step 2: Skriv testen**

```typescript
// test/market-migration.pg.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { setupTestDb } from './helpers.js';

let db: Db;
beforeAll(async () => { db = await setupTestDb(); });
afterAll(async () => { await db.end(); });

describe('0022 market_insight', () => {
  it('oppretter market_signals og insight_cards', async () => {
    const t = await db.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name IN ('market_signals','insight_cards')`,
    );
    expect(t.rows.map((r) => r.table_name).sort()).toEqual(['insight_cards', 'market_signals']);
  });
});
```

- [ ] **Step 3: Kjør testen**

Run: `~/.bun/bin/bun run test test/market-migration.pg.test.ts`
Expected: PASS (migrate.ts kjører 0022 automatisk mot reknaren_test via setupTestDb).

- [ ] **Step 4: Commit**

```bash
git add migrations/0022_market_insight.sql test/market-migration.pg.test.ts
git commit -m "feat(market): migrasjon 0022 — market_signals + insight_cards"
```

---

### Task 2: Signal-store

**Files:**
- Create: `src/market/signal-store.ts`
- Test: `test/market-signal-store.pg.test.ts`

**Interfaces:**
- Consumes: `Db` fra `src/db/pool.js`.
- Produces:
  - `interface MarketSignal { source: string; kind: string; signalKey: string; value: string; unit: string; period: string; publishedAt?: string; url?: string; raw?: unknown }`
  - `async function upsertSignal(db: Db, s: MarketSignal): Promise<void>` — insert eller oppdater på `(source,kind,signal_key,period)`.
  - `async function latestSignal(db: Db, kind: string, signalKey: string): Promise<MarketSignal | null>` — nyeste periode.
  - `async function previousSignal(db: Db, kind: string, signalKey: string): Promise<MarketSignal | null>` — nest-nyeste periode (for Δ).

- [ ] **Step 1: Skriv testen**

```typescript
// test/market-signal-store.pg.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { latestSignal, previousSignal, upsertSignal } from '../src/market/signal-store.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
beforeAll(async () => { db = await setupTestDb(); await truncateAll(); });
afterAll(async () => { await db.end(); });

describe('signal-store', () => {
  it('lagrer, oppdaterer og leser siste + forrige', async () => {
    await upsertSignal(db, { source: 'norges_bank', kind: 'policy_rate', signalKey: 'KPRA', value: '4.25', unit: 'percent', period: '2026-06-19' });
    await upsertSignal(db, { source: 'norges_bank', kind: 'policy_rate', signalKey: 'KPRA', value: '4.50', unit: 'percent', period: '2026-08-14' });
    // idempotent oppdatering av samme periode
    await upsertSignal(db, { source: 'norges_bank', kind: 'policy_rate', signalKey: 'KPRA', value: '4.50', unit: 'percent', period: '2026-08-14' });

    const latest = await latestSignal(db, 'policy_rate', 'KPRA');
    const prev = await previousSignal(db, 'policy_rate', 'KPRA');
    expect(latest?.value).toBe('4.50');
    expect(latest?.period).toBe('2026-08-14');
    expect(prev?.value).toBe('4.25');
  });
});
```

- [ ] **Step 2: Kjør testen — forvent FAIL** (`Cannot find module signal-store`).

Run: `~/.bun/bin/bun run test test/market-signal-store.pg.test.ts`

- [ ] **Step 3: Implementer**

```typescript
// src/market/signal-store.ts
import type { Db } from '../db/pool.js';

export interface MarketSignal {
  source: string;
  kind: string;
  signalKey: string;
  value: string;      // NUMERIC leses/skrives som string for eksakthet
  unit: string;
  period: string;
  publishedAt?: string | undefined;
  url?: string | undefined;
  raw?: unknown;
}

export async function upsertSignal(db: Db, s: MarketSignal): Promise<void> {
  await db.query(
    `INSERT INTO market_signals (source, kind, signal_key, value_num, unit, period, published_at, url, raw)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (source, kind, signal_key, period)
     DO UPDATE SET value_num = EXCLUDED.value_num, unit = EXCLUDED.unit,
                   published_at = EXCLUDED.published_at, url = EXCLUDED.url,
                   raw = EXCLUDED.raw, observed_at = now()`,
    [s.source, s.kind, s.signalKey, s.value, s.unit, s.period,
     s.publishedAt ?? null, s.url ?? null, s.raw != null ? JSON.stringify(s.raw) : null],
  );
}

function rowToSignal(r: Record<string, unknown>): MarketSignal {
  return {
    source: r.source as string, kind: r.kind as string, signalKey: r.signal_key as string,
    value: String(r.value_num), unit: r.unit as string, period: r.period as string,
    publishedAt: (r.published_at as string) ?? undefined, url: (r.url as string) ?? undefined,
  };
}

async function nthSignal(db: Db, kind: string, signalKey: string, offset: number): Promise<MarketSignal | null> {
  const r = await db.query(
    `SELECT * FROM market_signals WHERE kind=$1 AND signal_key=$2
     ORDER BY period DESC LIMIT 1 OFFSET $3`,
    [kind, signalKey, offset],
  );
  return r.rows[0] ? rowToSignal(r.rows[0]) : null;
}

export const latestSignal = (db: Db, kind: string, signalKey: string) => nthSignal(db, kind, signalKey, 0);
export const previousSignal = (db: Db, kind: string, signalKey: string) => nthSignal(db, kind, signalKey, 1);
```

- [ ] **Step 4: Kjør testen — forvent PASS.** Kjør deretter `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/market/signal-store.ts test/market-signal-store.pg.test.ts
git commit -m "feat(market): signal-store (upsert + siste/forrige)"
```

---

### Task 3: Kilde — Norges Bank styringsrente

**Files:**
- Create: `src/market/sources/policy-rate.ts`
- Test: `test/market-policy-rate.test.ts`

**Interfaces:**
- Produces:
  - `interface RateObservation { value: string; period: string; source: string }`
  - `interface PolicyRateSource { latest(): Promise<RateObservation | null> }`
  - `class NorgesBankPolicyRate implements PolicyRateSource` (konstruktør tar injiserbar `fetchImpl` som `fx-rates.ts`).
  - `class StaticPolicyRateStub implements PolicyRateSource`.

**Bakgrunn:** Norges Bank IR-datasett, serie `B.KPRA.SD.` (styringsrente, daglig). Samme SDMX-JSON-form som EXR i `fx-rates.ts` — én serie, velg nyeste observasjon. URL:
`https://data.norges-bank.no/api/data/IR/B.KPRA.SD.?format=sdmx-json&lastNObservations=2`

- [ ] **Step 1: Skriv testen** (stub + parsing av en SDMX-JSON-fixture)

```typescript
// test/market-policy-rate.test.ts
import { describe, expect, it } from 'vitest';
import { NorgesBankPolicyRate, StaticPolicyRateStub } from '../src/market/sources/policy-rate.js';

const SDMX = {
  data: {
    structure: { dimensions: { observation: [{ values: [{ id: '2026-06-19' }, { id: '2026-08-14' }] }] } },
    dataSets: [{ series: { '0:0:0:0': { observations: { '0': ['4.25'], '1': ['4.50'] } } } }],
  },
};

describe('NorgesBankPolicyRate', () => {
  it('parser nyeste observasjon fra SDMX-JSON', async () => {
    const fake = async () => ({ status: 200, ok: true, json: async () => SDMX });
    const src = new NorgesBankPolicyRate(fake as never);
    const r = await src.latest();
    expect(r?.value).toBe('4.50');
    expect(r?.period).toBe('2026-08-14');
  });
  it('stub returnerer oppgitt verdi', async () => {
    const r = await new StaticPolicyRateStub('4.50', '2026-08-14').latest();
    expect(r?.value).toBe('4.50');
  });
});
```

- [ ] **Step 2: Kjør testen — forvent FAIL.**

Run: `~/.bun/bin/bun run test test/market-policy-rate.test.ts`

- [ ] **Step 3: Implementer** (speil `fx-rates.ts`; verdien er allerede i prosent — ingen unit-mult)

```typescript
// src/market/sources/policy-rate.ts
export interface RateObservation { value: string; period: string; source: string }
export interface PolicyRateSource { latest(): Promise<RateObservation | null> }

type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{
  status: number; ok: boolean; json(): Promise<unknown>;
}>;

const URL = 'https://data.norges-bank.no/api/data/IR/B.KPRA.SD.?format=sdmx-json&lastNObservations=2';

export class NorgesBankPolicyRate implements PolicyRateSource {
  constructor(private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike, private readonly timeoutMs = 8000) {}
  async latest(): Promise<RateObservation | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(URL, { signal: controller.signal, headers: { accept: 'application/json' } });
      if (!res.ok) return null;
      const body = (await res.json()) as any;
      const obsDates: { id: string }[] = body?.data?.structure?.dimensions?.observation?.[0]?.values ?? [];
      const series = Object.values(body?.data?.dataSets?.[0]?.series ?? {})[0] as any;
      if (!series?.observations) return null;
      let bestIdx = -1, bestDate = '';
      for (const idx of Object.keys(series.observations)) {
        const date = obsDates[Number(idx)]?.id ?? '';
        if (date >= bestDate) { bestDate = date; bestIdx = Number(idx); }
      }
      if (bestIdx < 0) return null;
      const raw = String(series.observations[String(bestIdx)]?.[0] ?? '');
      if (!/^\d+(\.\d+)?$/.test(raw)) return null;
      return { value: raw, period: bestDate, source: `Norges Bank (${bestDate})` };
    } catch { return null; } finally { clearTimeout(timer); }
  }
}

export class StaticPolicyRateStub implements PolicyRateSource {
  constructor(private readonly value: string, private readonly period: string) {}
  async latest(): Promise<RateObservation | null> {
    return { value: this.value, period: this.period, source: 'stub' };
  }
}
```

- [ ] **Step 4: Kjør testen — forvent PASS.** Så `npx tsc --noEmit`.

- [ ] **Step 5: Live-verifisering (én gang, manuelt)**

Run: `curl -s 'https://data.norges-bank.no/api/data/IR/B.KPRA.SD.?format=sdmx-json&lastNObservations=2' | head -c 400`
Bekreft at responsen har `data.dataSets[0].series` og `data.structure.dimensions.observation`. Hvis seriekoden `B.KPRA.SD.` ikke gir data, prøv `B.KPRA.` og oppdater `URL`. Noter faktisk verdi i commit-meldingen.

- [ ] **Step 6: Commit**

```bash
git add src/market/sources/policy-rate.ts test/market-policy-rate.test.ts
git commit -m "feat(market): Norges Bank styringsrente-kilde (port + stub)"
```

---

### Task 4: Kilde — SSB KPI (12-mnd endring)

**Files:**
- Create: `src/market/sources/kpi.ts`
- Test: `test/market-kpi.test.ts`

**Interfaces:**
- Produces:
  - `interface KpiObservation { value: string; period: string; source: string }` (value = prosent 12-mnd endring)
  - `interface KpiSource { latest(): Promise<KpiObservation | null> }`
  - `class SsbKpi implements KpiSource` (injiserbar `fetchImpl`).
  - `class StaticKpiStub implements KpiSource`.

**Bakgrunn:** SSB PxWebApi tabell `03014` (KPI, 12-mnd endring). POST med JSON-stat2-svar. Endepunkt `https://data.ssb.no/api/v0/no/table/03014/`. Query velger `ContentsCode=Tolvmanedersendring` og siste periode (`"selection":{"filter":"top","values":["1"]}` på Tid). Svaret er JSON-stat2: `response.value` er tallmatrisen, `response.dimension.Tid.category.index` gir periodene.

- [ ] **Step 1: Skriv testen**

```typescript
// test/market-kpi.test.ts
import { describe, expect, it } from 'vitest';
import { SsbKpi, StaticKpiStub } from '../src/market/sources/kpi.js';

const JSONSTAT = {
  dimension: { Tid: { category: { index: { '2026M07': 0 }, label: { '2026M07': '2026M07' } } } },
  value: [3.4],
};

describe('SsbKpi', () => {
  it('leser siste 12-mnd-endring fra JSON-stat2', async () => {
    const fake = async () => ({ status: 200, ok: true, json: async () => JSONSTAT });
    const r = await new SsbKpi(fake as never).latest();
    expect(r?.value).toBe('3.4');
    expect(r?.period).toBe('2026-07');
  });
  it('stub', async () => {
    expect((await new StaticKpiStub('3.4', '2026-07').latest())?.value).toBe('3.4');
  });
});
```

- [ ] **Step 2: Kjør testen — forvent FAIL.**

- [ ] **Step 3: Implementer**

```typescript
// src/market/sources/kpi.ts
export interface KpiObservation { value: string; period: string; source: string }
export interface KpiSource { latest(): Promise<KpiObservation | null> }

type FetchLike = (url: string, init?: {
  method?: string; body?: string; signal?: AbortSignal; headers?: Record<string, string>;
}) => Promise<{ status: number; ok: boolean; json(): Promise<unknown> }>;

const ENDPOINT = 'https://data.ssb.no/api/v0/no/table/03014/';
const QUERY = {
  query: [{ code: 'ContentsCode', selection: { filter: 'item', values: ['Tolvmanedersendring'] } }],
  response: { format: 'json-stat2' },
};

/** '2026M07' → '2026-07' */
function normPeriod(p: string): string {
  const m = /^(\d{4})M(\d{2})$/.exec(p);
  return m ? `${m[1]}-${m[2]}` : p;
}

export class SsbKpi implements KpiSource {
  constructor(private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike, private readonly timeoutMs = 8000) {}
  async latest(): Promise<KpiObservation | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(ENDPOINT, {
        method: 'POST', body: JSON.stringify(QUERY),
        signal: controller.signal, headers: { 'content-type': 'application/json', accept: 'application/json' },
      });
      if (!res.ok) return null;
      const body = (await res.json()) as any;
      const values: number[] = body?.value ?? [];
      const index: Record<string, number> = body?.dimension?.Tid?.category?.index ?? {};
      const periods = Object.keys(index);
      if (!periods.length || !values.length) return null;
      // siste periode = høyeste index
      const lastPeriod = periods.reduce((a, b) => (index[b]! >= index[a]! ? b : a));
      const raw = values[index[lastPeriod]!];
      if (raw == null || Number.isNaN(raw)) return null;
      return { value: String(raw), period: normPeriod(lastPeriod), source: `SSB tabell 03014 (${normPeriod(lastPeriod)})` };
    } catch { return null; } finally { clearTimeout(timer); }
  }
}

export class StaticKpiStub implements KpiSource {
  constructor(private readonly value: string, private readonly period: string) {}
  async latest(): Promise<KpiObservation | null> {
    return { value: this.value, period: this.period, source: 'stub' };
  }
}
```

- [ ] **Step 4: Kjør testen — forvent PASS.** Så `npx tsc --noEmit`.

- [ ] **Step 5: Live-verifisering (én gang)**

Run:
```bash
curl -s -X POST 'https://data.ssb.no/api/v0/no/table/03014/' \
  -H 'content-type: application/json' \
  -d '{"query":[{"code":"ContentsCode","selection":{"filter":"item","values":["Tolvmanedersendring"]}}],"response":{"format":"json-stat2"}}' | head -c 500
```
Bekreft `value` og `dimension.Tid.category.index`. Hvis `ContentsCode`-verdien `Tolvmanedersendring` avvises, hent gyldige koder fra `curl -s https://data.ssb.no/api/v0/no/table/03014/ | python3 -c "import sys,json;d=json.load(sys.stdin);print([v for v in d['variables'] if v['code']=='ContentsCode'])"` og oppdater `QUERY`.

- [ ] **Step 6: Commit**

```bash
git add src/market/sources/kpi.ts test/market-kpi.test.ts
git commit -m "feat(market): SSB KPI 12-mnd-kilde (port + stub)"
```

---

### Task 5: Org-eksponering (hovedbok + NACE)

**Files:**
- Modify: `src/integrations/company-registry.ts` (legg til `naceCode`)
- Create: `src/market/exposure.ts`
- Test: `test/market-exposure.pg.test.ts`

**Interfaces:**
- Consumes: `Db`, `CompanyRegistry` fra `company-registry.js`, `journal_lines`-skjema.
- Produces:
  - `interface OrgExposure { interestBearingDebtMinor: bigint; fxCurrencies: string[]; naceCode: string | null }`
  - `async function getOrgExposure(db: Db, registry: CompanyRegistry, organizationId: string): Promise<OrgExposure>`

**Detaljer:**
- **Rentebærende gjeld:** saldo på kontoklasse 22xx–24xx (langsiktig gjeld til kredittinstitusjoner + kassekreditt), norsk standard kontoplan. Saldo = `SUM(credit_minor - debit_minor)` (gjeld har kredittsaldo).
- **Valutaeksponering:** distinkte valutaer i `journal_lines` der `original_currency` er satt og ≠ 'NOK'. *(Sjekk kolonnenavn i steg 1 — `journal_lines` har `original_amount_minor`; finn tilhørende valutakolonne med `grep -n "currency" migrations/0001*.sql`. Hvis ingen valutakolonne finnes, returner tom liste og noter det.)*
- **NACE:** `organizations.org_number` → `registry.lookup(orgNumber)` → `profile.naceCode`.

- [ ] **Step 1: Utvid `CompanyProfile` med NACE**

I `src/integrations/company-registry.ts`: legg `naceCode?: string | null;` i `interface CompanyProfile`, og i `BrregCompanyRegistry.lookup` parse `b.naeringskode1?.kode`:

```typescript
// i typedeklarasjonen for b:
naeringskode1?: { kode?: string };
// i returobjektet:
naceCode: b.naeringskode1?.kode ?? null,
```
Legg også `naceCode` i `StaticCompanyRegistryStub`-entries ved behov (test styrer det).

- [ ] **Step 2: Skriv testen**

```typescript
// test/market-exposure.pg.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { StaticCompanyRegistryStub } from '../src/integrations/company-registry.js';
import { getOrgExposure } from '../src/market/exposure.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { postJournalEntry } from '../src/ledger/journal.js'; // bruk eksisterende bokførings-API
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
beforeAll(async () => { db = await setupTestDb(); await truncateAll(); });
afterAll(async () => { await db.end(); });

describe('getOrgExposure', () => {
  it('summerer rentebærende gjeld og henter NACE', async () => {
    const userId = await ensureUser(db, 'exp@x.no', 'Eksp');
    const org = await createOrganization(db, { name: 'Eksp AS', orgForm: 'AS', vatStatus: 'registered', orgNumber: '910000004', createdByUserId: userId });
    // Bokfør: bank 300 000 debet, banklån (2240) 300 000 kredit
    await postJournalEntry(db, {
      organizationId: org.id, actor: { userId, role: 'owner' }, entryDate: '2026-08-01', description: 'Låneopptak',
      lines: [
        { accountNumber: '1920', debitMinor: 30000000n, creditMinor: 0n },
        { accountNumber: '2240', debitMinor: 0n, creditMinor: 30000000n },
      ],
    });
    const registry = new StaticCompanyRegistryStub({ '910000004': { found: true, orgNumber: '910000004', naceCode: '62.010' } });
    const exp = await getOrgExposure(db, registry, org.id);
    expect(exp.interestBearingDebtMinor).toBe(30000000n);
    expect(exp.naceCode).toBe('62.010');
  });
});
```
*(Verifiser signaturen til `postJournalEntry`/`createOrganization` mot faktiske filer før du kjører — juster feltnavn om nødvendig. Målet er én bokført gjeldspostering.)*

- [ ] **Step 3: Kjør testen — forvent FAIL.**

- [ ] **Step 4: Implementer**

```typescript
// src/market/exposure.ts
import type { Db } from '../db/pool.js';
import type { CompanyRegistry } from '../integrations/company-registry.js';

export interface OrgExposure {
  interestBearingDebtMinor: bigint;
  fxCurrencies: string[];
  naceCode: string | null;
}

export async function getOrgExposure(db: Db, registry: CompanyRegistry, organizationId: string): Promise<OrgExposure> {
  // Rentebærende gjeld: kontoklasse 2200–2499, kredittsaldo.
  const debt = await db.query(
    `SELECT COALESCE(SUM(l.credit_minor - l.debit_minor), 0)::TEXT AS net
       FROM journal_lines l
       JOIN journal_entries e ON e.id = l.entry_id AND e.status = 'posted'
      WHERE l.organization_id = $1
        AND l.account_number ~ '^[0-9]{4}$'
        AND l.account_number::int BETWEEN 2200 AND 2499`,
    [organizationId],
  );
  const interestBearingDebtMinor = BigInt(debt.rows[0]?.net ?? '0');

  // Valutaeksponering — se steg 1-notat. Hvis valutakolonne finnes:
  const fx = await db.query(
    `SELECT DISTINCT l.original_currency AS cur
       FROM journal_lines l
      WHERE l.organization_id = $1 AND l.original_currency IS NOT NULL AND l.original_currency <> 'NOK'`,
    [organizationId],
  ).catch(() => ({ rows: [] as { cur: string }[] }));
  const fxCurrencies = fx.rows.map((r) => r.cur).filter(Boolean);

  // NACE fra Brreg via org.nr.
  const orgRow = await db.query(`SELECT org_number FROM organizations WHERE id = $1`, [organizationId]);
  const orgNumber = orgRow.rows[0]?.org_number as string | undefined;
  let naceCode: string | null = null;
  if (orgNumber && /^\d{9}$/.test(orgNumber)) {
    try { naceCode = (await registry.lookup(orgNumber)).naceCode ?? null; } catch { naceCode = null; }
  }
  return { interestBearingDebtMinor, fxCurrencies, naceCode };
}
```
*(Juster `organizations`-kolonnen `org_number` og `journal_lines`-valutakolonnen til faktiske navn funnet i steg 1/migrasjon 0001.)*

- [ ] **Step 5: Kjør testen — forvent PASS.** Så `npx tsc --noEmit`.

- [ ] **Step 6: Commit**

```bash
git add src/integrations/company-registry.ts src/market/exposure.ts test/market-exposure.pg.test.ts
git commit -m "feat(market): org-eksponering (rentebærende gjeld + valuta + NACE)"
```

---

### Task 6: Innsikts-motoren (ren, deterministisk)

**Files:**
- Create: `src/market/engine.ts`
- Test: `test/market-engine.test.ts`

**Interfaces:**
- Consumes: `MarketSignal` (signal-store), `OrgExposure` (exposure).
- Produces:
  - `interface GeneratedCard { kind: string; severity: 'signal'|'opportunity'|'watch'; title: string; body: string; impactMinor: bigint | null; direction: 'cost'|'benefit'|'neutral'; signalRefs: {kind:string; signalKey:string; period:string}[]; sources: {label:string; url?:string}[] }`
  - `function buildInsights(input: { policyRate?: MarketSignal|null; policyRatePrev?: MarketSignal|null; kpi?: MarketSignal|null; exposure: OrgExposure }): GeneratedCard[]`

**Regler v1:**
1. **rate_debt** — `severity='watch'`, `direction='cost'`. Bare hvis Δrente ≠ 0 og gjeld > 0. `impactMinor = round(|Δrentedesimal| * gjeld)` (årlig kroner). Δ = (siste − forrige) styringsrente i prosentpoeng; desimal = Δ/100.
2. **kpi_cost** — `severity='signal'`, `direction='neutral'`, `impactMinor=null`. Bare hvis KPI-signal finnes. Body nevner prosenten.
3. *(FX-regel er v1-valgfri; hopp over hvis `fxCurrencies` er tom. Ikke implementer full valutabeløps-effekt i v1 — krever fremtidige innkjøpsdata. La en placeholder-fri `fx`-regel stå ute til v2.)*

- [ ] **Step 1: Skriv testen**

```typescript
// test/market-engine.test.ts
import { describe, expect, it } from 'vitest';
import { buildInsights } from '../src/market/engine.js';
import type { OrgExposure } from '../src/market/exposure.js';

const exposure: OrgExposure = { interestBearingDebtMinor: 48000000n, fxCurrencies: [], naceCode: '62.010' };

describe('buildInsights', () => {
  it('rate_debt: renta opp 0,25 på 480 000 kr gjeld → +1 200 kr/år kost', () => {
    const cards = buildInsights({
      policyRate: { source: 'norges_bank', kind: 'policy_rate', signalKey: 'KPRA', value: '4.50', unit: 'percent', period: '2026-08-14' },
      policyRatePrev: { source: 'norges_bank', kind: 'policy_rate', signalKey: 'KPRA', value: '4.25', unit: 'percent', period: '2026-06-19' },
      exposure,
    });
    const rate = cards.find((c) => c.kind === 'rate_debt');
    expect(rate?.severity).toBe('watch');
    expect(rate?.direction).toBe('cost');
    expect(rate?.impactMinor).toBe(120000n); // 0.0025 * 48 000 000 øre = 120 000 øre = 1 200 kr
    expect(rate?.sources[0]?.label).toContain('Norges Bank');
  });

  it('ingen rate_debt når renta er uendret', () => {
    const cards = buildInsights({
      policyRate: { source: 'norges_bank', kind: 'policy_rate', signalKey: 'KPRA', value: '4.50', unit: 'percent', period: '2026-08-14' },
      policyRatePrev: { source: 'norges_bank', kind: 'policy_rate', signalKey: 'KPRA', value: '4.50', unit: 'percent', period: '2026-06-19' },
      exposure,
    });
    expect(cards.find((c) => c.kind === 'rate_debt')).toBeUndefined();
  });

  it('kpi_cost er et rent signal uten kroner-effekt', () => {
    const cards = buildInsights({
      kpi: { source: 'ssb', kind: 'kpi_yoy', signalKey: 'KPI', value: '3.4', unit: 'percent', period: '2026-07' },
      exposure,
    });
    const kpi = cards.find((c) => c.kind === 'kpi_cost');
    expect(kpi?.severity).toBe('signal');
    expect(kpi?.impactMinor).toBeNull();
    expect(kpi?.body).toContain('3,4');
  });
});
```

- [ ] **Step 2: Kjør testen — forvent FAIL.**

- [ ] **Step 3: Implementer**

```typescript
// src/market/engine.ts
import type { MarketSignal } from './signal-store.js';
import type { OrgExposure } from './exposure.js';

export interface GeneratedCard {
  kind: string;
  severity: 'signal' | 'opportunity' | 'watch';
  title: string;
  body: string;
  impactMinor: bigint | null;
  direction: 'cost' | 'benefit' | 'neutral';
  signalRefs: { kind: string; signalKey: string; period: string }[];
  sources: { label: string; url?: string }[];
}

/** '4.50' - '4.25' = 25 (basispunkt-styrke i hundredeler prosentpoeng, heltall). */
function deltaHundredths(a: string, b: string): bigint {
  const toH = (s: string): bigint => {
    const [i, f = ''] = s.split('.');
    const frac = (f + '00').slice(0, 2);
    return BigInt(i!) * 100n + BigInt(frac || '0');
  };
  return toH(a) - toH(b);
}

/** 1200 (øre? nei — kroner-øre) → '1 200' med tusenskille. Rene tall til norsk visning gjøres i UI; her holder vi bigint. */

export function buildInsights(input: {
  policyRate?: MarketSignal | null;
  policyRatePrev?: MarketSignal | null;
  kpi?: MarketSignal | null;
  exposure: OrgExposure;
}): GeneratedCard[] {
  const cards: GeneratedCard[] = [];
  const NB_URL = 'https://www.norges-bank.no/tema/pengepolitikk/Styringsrenten/';

  // Regel 1: rate_debt
  const { policyRate, policyRatePrev, exposure } = input;
  if (policyRate && policyRatePrev && exposure.interestBearingDebtMinor > 0n) {
    const dH = deltaHundredths(policyRate.value, policyRatePrev.value); // prosentpoeng * 100
    if (dH !== 0n) {
      // årlig kroner-effekt = |Δ| (i prosentpoeng/100/100) * gjeld
      // impact_øre = |dH| * gjeld_øre / 10000  (dH er prosentpoeng*100 ⇒ del på 100 for %, del på 100 for desimal)
      const impact = (dH < 0n ? -dH : dH) * exposure.interestBearingDebtMinor / 10000n;
      const opp = dH < 0n;
      const retning = opp ? 'lavere' : 'høyere';
      const pp = (Number(dH) / 100).toLocaleString('nb-NO', { minimumFractionDigits: 2 });
      cards.push({
        kind: 'rate_debt',
        severity: opp ? 'opportunity' : 'watch',
        direction: opp ? 'benefit' : 'cost',
        title: `Styringsrenta ${opp ? 'ned' : 'opp'} ${pp} prosentpoeng`,
        body: `Med rentebærende gjeld i bøkene betyr det anslagsvis ${retning} rentekostnad. Legg det inn i likviditetsplanen.`,
        impactMinor: impact,
        signalRefs: [{ kind: policyRate.kind, signalKey: policyRate.signalKey, period: policyRate.period }],
        sources: [{ label: policyRate.source, url: NB_URL }],
      });
    }
  }

  // Regel 2: kpi_cost (rent signal)
  if (input.kpi) {
    const pct = Number(input.kpi.value).toLocaleString('nb-NO', { minimumFractionDigits: 1 });
    cards.push({
      kind: 'kpi_cost',
      severity: 'signal',
      direction: 'neutral',
      title: `Prisvekst (KPI) ${pct} %`,
      body: `Konsumprisene har steget ${pct} % siste 12 måneder. Vurder om egne priser og marginer henger med.`,
      impactMinor: null,
      signalRefs: [{ kind: input.kpi.kind, signalKey: input.kpi.signalKey, period: input.kpi.period }],
      sources: [{ label: input.kpi.source, url: 'https://www.ssb.no/kpi' }],
    });
  }

  return cards;
}
```

- [ ] **Step 4: Kjør testen — forvent PASS.** Verifiser at `impactMinor` er nøyaktig `120000n` i første test. Så `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/market/engine.ts test/market-engine.test.ts
git commit -m "feat(market): deterministisk innsikts-motor (rate_debt + kpi_cost)"
```

---

### Task 7: Orkestrering — refresh + regenerering

**Files:**
- Create: `src/market/refresh.ts`
- Test: `test/market-refresh.pg.test.ts`

**Interfaces:**
- Consumes: signal-store, kilder (`PolicyRateSource`, `KpiSource`, `FxRateSource`), `getOrgExposure`, `buildInsights`.
- Produces:
  - `interface MarketSources { policyRate: PolicyRateSource; kpi: KpiSource; registry: CompanyRegistry }`
  - `async function refreshMarketSignals(db: Db, sources: MarketSources): Promise<{ updated: string[] }>` — henter alle kilder, upserter signaler.
  - `async function regenerateInsights(db: Db, sources: MarketSources, organizationId: string): Promise<number>` — leser signaler + eksponering, kjører motoren, skriver `insight_cards` (DELETE eksisterende ikke-avviste + INSERT nye i én transaksjon; behold avviste). Returnerer antall kort.
  - `async function regenerateAllOrgs(db: Db, sources: MarketSources): Promise<{ orgs: number; cards: number }>`.

- [ ] **Step 1: Skriv testen**

```typescript
// test/market-refresh.pg.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { StaticCompanyRegistryStub } from '../src/integrations/company-registry.js';
import { StaticPolicyRateStub } from '../src/market/sources/policy-rate.js';
import { StaticKpiStub } from '../src/market/sources/kpi.js';
import { refreshMarketSignals, regenerateInsights } from '../src/market/refresh.js';
import { upsertSignal } from '../src/market/signal-store.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { postJournalEntry } from '../src/ledger/journal.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
beforeAll(async () => { db = await setupTestDb(); await truncateAll(); });
afterAll(async () => { await db.end(); });

const sources = {
  policyRate: new StaticPolicyRateStub('4.50', '2026-08-14'),
  kpi: new StaticKpiStub('3.4', '2026-07'),
  registry: new StaticCompanyRegistryStub({ '910000004': { found: true, orgNumber: '910000004', naceCode: '62.010' } }),
};

describe('refresh + regenerate', () => {
  it('lagrer signaler og genererer kort mot org-gjeld', async () => {
    // forrige rente for Δ
    await upsertSignal(db, { source: 'norges_bank', kind: 'policy_rate', signalKey: 'KPRA', value: '4.25', unit: 'percent', period: '2026-06-19' });
    await refreshMarketSignals(db, sources);

    const userId = await ensureUser(db, 'r@x.no', 'R');
    const org = await createOrganization(db, { name: 'R AS', orgForm: 'AS', vatStatus: 'registered', orgNumber: '910000004', createdByUserId: userId });
    await postJournalEntry(db, { organizationId: org.id, actor: { userId, role: 'owner' }, entryDate: '2026-08-01', description: 'Lån',
      lines: [{ accountNumber: '1920', debitMinor: 48000000n, creditMinor: 0n }, { accountNumber: '2240', debitMinor: 0n, creditMinor: 48000000n }] });

    const n = await regenerateInsights(db, sources, org.id);
    expect(n).toBeGreaterThanOrEqual(2); // rate_debt + kpi_cost
    const rows = await db.query(`SELECT kind, impact_minor FROM insight_cards WHERE organization_id=$1 ORDER BY kind`, [org.id]);
    const rate = rows.rows.find((r) => r.kind === 'rate_debt');
    expect(BigInt(rate.impact_minor)).toBe(120000n);
  });
});
```

- [ ] **Step 2: Kjør testen — forvent FAIL.**

- [ ] **Step 3: Implementer**

```typescript
// src/market/refresh.ts
import type { Db } from '../db/pool.js';
import type { CompanyRegistry } from '../integrations/company-registry.js';
import { buildInsights } from './engine.js';
import { getOrgExposure } from './exposure.js';
import type { KpiSource } from './sources/kpi.js';
import type { PolicyRateSource } from './sources/policy-rate.js';
import { latestSignal, previousSignal, upsertSignal } from './signal-store.js';

export interface MarketSources {
  policyRate: PolicyRateSource;
  kpi: KpiSource;
  registry: CompanyRegistry;
}

export async function refreshMarketSignals(db: Db, sources: MarketSources): Promise<{ updated: string[] }> {
  const updated: string[] = [];
  const rate = await sources.policyRate.latest();
  if (rate) {
    await upsertSignal(db, { source: 'norges_bank', kind: 'policy_rate', signalKey: 'KPRA', value: rate.value, unit: 'percent', period: rate.period });
    updated.push('policy_rate');
  }
  const kpi = await sources.kpi.latest();
  if (kpi) {
    await upsertSignal(db, { source: 'ssb', kind: 'kpi_yoy', signalKey: 'KPI', value: kpi.value, unit: 'percent', period: kpi.period });
    updated.push('kpi_yoy');
  }
  return { updated };
}

export async function regenerateInsights(db: Db, sources: MarketSources, organizationId: string): Promise<number> {
  const [policyRate, policyRatePrev, kpi, exposure] = await Promise.all([
    latestSignal(db, 'policy_rate', 'KPRA'),
    previousSignal(db, 'policy_rate', 'KPRA'),
    latestSignal(db, 'kpi_yoy', 'KPI'),
    getOrgExposure(db, sources.registry, organizationId),
  ]);
  const cards = buildInsights({ policyRate, policyRatePrev, kpi, exposure });

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Behold avviste kort; erstatt de aktive.
    await client.query(`DELETE FROM insight_cards WHERE organization_id=$1 AND dismissed_at IS NULL`, [organizationId]);
    for (const c of cards) {
      await client.query(
        `INSERT INTO insight_cards (organization_id, kind, severity, title, body, impact_minor, direction, signal_refs, sources, valid_until)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now() + interval '14 days')
         ON CONFLICT (organization_id, kind) DO UPDATE SET
           severity=EXCLUDED.severity, title=EXCLUDED.title, body=EXCLUDED.body,
           impact_minor=EXCLUDED.impact_minor, direction=EXCLUDED.direction,
           signal_refs=EXCLUDED.signal_refs, sources=EXCLUDED.sources,
           valid_until=EXCLUDED.valid_until, dismissed_at=NULL, created_at=now()`,
        [organizationId, c.kind, c.severity, c.title, c.body,
         c.impactMinor === null ? null : c.impactMinor.toString(), c.direction,
         JSON.stringify(c.signalRefs), JSON.stringify(c.sources)],
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return cards.length;
}

export async function regenerateAllOrgs(db: Db, sources: MarketSources): Promise<{ orgs: number; cards: number }> {
  const orgs = await db.query(`SELECT id FROM organizations`);
  let cards = 0;
  for (const row of orgs.rows) cards += await regenerateInsights(db, sources, row.id as string);
  return { orgs: orgs.rowCount ?? 0, cards };
}
```
*(NB: `DELETE` + `ON CONFLICT` overlapper trygt — DELETE fjerner ikke-avviste, INSERT/UPDATE gjenoppretter. Hvis et avvist kort finnes for samme `(org,kind)`, vil `ON CONFLICT ... dismissed_at=NULL` gjenopplive det ved nytt signal — ønsket: nytt signal fortjener ny visning.)*

- [ ] **Step 4: Kjør testen — forvent PASS.** Så `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/market/refresh.ts test/market-refresh.pg.test.ts
git commit -m "feat(market): refresh + regenerering (signaler → kort per org)"
```

---

### Task 8: API — cron-rute + les-rute + wiring

**Files:**
- Modify: `src/api/server.ts` (rutene + `ApiDeps`-felt `marketSources`)
- Modify: `src/api/main.ts` (instansier `marketSources`)
- Test: `test/market-api.pg.test.ts`

**Interfaces:**
- Consumes: `MarketSources`, `refreshMarketSignals`, `regenerateAllOrgs`, cron-token-mønster (`x-cron-secret` + `timingSafeEqual`).
- Produces:
  - `POST /api/cron/market-refresh` (token-auth) → `{ updated, orgs, cards }`.
  - `GET /api/organizations/:orgId/market/insights` (sesjons-auth, samme middleware som andre org-ruter) → `{ cards: [...] }` (ikke-avviste, nyeste først; `impact_minor` som string i JSON via `toJson`).
  - `POST /api/organizations/:orgId/market/insights/:id/dismiss` → setter `dismissed_at`.

- [ ] **Step 1: Legg `marketSources` i `ApiDeps`** (i `server.ts`, ved siden av `cronSecret`):

```typescript
// i interface ApiDeps:
marketSources?: import('../market/refresh.js').MarketSources | undefined;
```

- [ ] **Step 2: Skriv cron-ruten** (speil `/api/cron/stripe-sync` token-blokken 1:1)

```typescript
app.post('/api/cron/market-refresh', async (req, res, next) => {
  try {
    const secret = deps.cronSecret;
    if (!secret || secret.length < 16) { res.status(503).json({ error: { code: 'CRON_NOT_CONFIGURED', message: 'REKNAREN_CRON_SECRET mangler eller er for kort.' } }); return; }
    const provided = typeof req.headers['x-cron-secret'] === 'string' ? (req.headers['x-cron-secret'] as string) : '';
    const a = Buffer.from(secret); const b = Buffer.from(provided);
    if (a.length !== b.length || !timingSafeEqual(a, b)) { res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Ugyldig cron-token.' } }); return; }
    if (!deps.marketSources) { res.status(503).json({ error: { code: 'MARKET_NOT_CONFIGURED', message: 'Markedskilder er ikke konfigurert.' } }); return; }
    const { refreshMarketSignals, regenerateAllOrgs } = await import('../market/refresh.js');
    const refreshed = await refreshMarketSignals(deps.db, deps.marketSources);
    const regen = await regenerateAllOrgs(deps.db, deps.marketSources);
    res.json({ ...refreshed, ...regen });
  } catch (err) { next(err); }
});
```

- [ ] **Step 3: Skriv les- + dismiss-rutene** (bruk samme org-auth-middleware som en eksisterende `GET /api/organizations/:orgId/dashboard`-rute — finn den i `server.ts` og kopier `requireOrgAccess`/tilsvarende mønster):

```typescript
app.get('/api/organizations/:orgId/market/insights', /* samme org-auth som dashboard */ async (req, res, next) => {
  try {
    const orgId = req.params.orgId!;
    const r = await deps.db.query(
      `SELECT id, kind, severity, title, body, impact_minor, direction, signal_refs, sources, created_at
         FROM insight_cards WHERE organization_id=$1 AND dismissed_at IS NULL
        ORDER BY (impact_minor IS NULL), abs(COALESCE(impact_minor,0)) DESC, created_at DESC`,
      [orgId],
    );
    res.json(toJson({ cards: r.rows }));
  } catch (err) { next(err); }
});

app.post('/api/organizations/:orgId/market/insights/:id/dismiss', /* org-auth */ async (req, res, next) => {
  try {
    await deps.db.query(`UPDATE insight_cards SET dismissed_at=now() WHERE id=$1 AND organization_id=$2`, [req.params.id, req.params.orgId]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});
```

- [ ] **Step 4: Wire i `main.ts`** (ved siden av `fxRates`/`companyRegistry`):

```typescript
import { NorgesBankPolicyRate } from '../market/sources/policy-rate.js';
import { SsbKpi } from '../market/sources/kpi.js';
// deps:
marketSources: { policyRate: new NorgesBankPolicyRate(), kpi: new SsbKpi(), registry: /* eksisterende BrregCompanyRegistry-instans */ },
```

- [ ] **Step 5: Skriv API-testen** (bygg app via samme testoppsett som andre `*-api`/server-tester; kall cron med gyldig token + les tilbake):

```typescript
// test/market-api.pg.test.ts — mønster fra eksisterende server-test:
// 1. buildServer med deps.cronSecret='x'.repeat(16), deps.marketSources = stubber, seed org+gjeld.
// 2. POST /api/cron/market-refresh med header x-cron-secret → 200, body.cards >= 1.
// 3. GET /api/organizations/:orgId/market/insights (autentisert) → cards inneholder rate_debt.
// (Kopier auth-oppsett fra nærmeste eksisterende server-test i test/.)
```

- [ ] **Step 6: Kjør testen — forvent PASS.** Så `npx tsc --noEmit`.

- [ ] **Step 7: Commit**

```bash
git add src/api/server.ts src/api/main.ts test/market-api.pg.test.ts
git commit -m "feat(market): cron-refresh + les/dismiss-ruter + wiring"
```

---

### Task 9: Frontend — innsikts-kort i Oversikt + Framover

**Files:**
- Modify: `web/src/styles.css` (`.icard`-stiler — hent fra artifact-brief)
- Modify: `web/src/screens.tsx` (`MarketInsightCard` + `VerdtÅVite`-panel; render etter `<KomIGang>` i `OverviewScreen` ~linje 244; øverste kort i Framover-visningen)
- Modify: `web/src/api.ts` (typene trengs ikke — bruk `api<...>()` generisk)

**Interfaces:**
- Consumes: `GET /api/organizations/:orgId/market/insights`.
- Produces: `MarketInsightCard`-komponent + `VerdtÅVite`-panel (React).

- [ ] **Step 1: Legg `.icard`-stiler i `styles.css`** (kopier `.icard`, `.icard::before`, `.icard.opp/.watch`, `.tag`, `.impact`, `.foot`, `.chip`-reglene fra `docs/market-insight-plan-v1.md`-artifacten / `scratchpad/reknaren-markedsinnsikt.html`, tilpasset eksisterende tokens — de bruker allerede `--gold`, `--warn`, `--accent`, `--danger`, `--ok`).

- [ ] **Step 2: Skriv `MarketInsightCard` + panel i `screens.tsx`**

```tsx
type InsightCard = {
  id: string; kind: string; severity: 'signal'|'opportunity'|'watch';
  title: string; body: string; impact_minor: string | null;
  direction: 'cost'|'benefit'|'neutral';
  sources: { label: string; url?: string }[];
};

function kr(minorStr: string | null): string | null {
  if (minorStr === null) return null;
  const kr = Number(BigInt(minorStr)) / 100;
  return kr.toLocaleString('nb-NO', { maximumFractionDigits: 0 }) + ' kr';
}

function MarketInsightCard({ c }: { c: InsightCard }) {
  const cls = c.severity === 'opportunity' ? 'icard opp' : c.severity === 'watch' ? 'icard watch' : 'icard';
  const impact = kr(c.impact_minor);
  const sign = c.direction === 'benefit' ? '−' : c.direction === 'cost' ? '+' : '';
  return (
    <div className={cls}>
      <div className="tag"><span className="sq" />{c.severity === 'opportunity' ? 'Mulighet' : c.severity === 'watch' ? 'Fortjener oppmerksomhet' : 'Signal'}</div>
      {impact && <div className={`impact num ${c.direction === 'benefit' ? 'pos' : c.direction === 'cost' ? 'neg' : ''}`}>{sign}{impact}{c.direction !== 'neutral' ? '/år' : ''}</div>}
      <div className="body" style={{ fontWeight: impact ? 400 : 600 }}>{c.title}. {c.body}</div>
      <div className="foot">
        {c.sources[0] && (c.sources[0].url
          ? <a className="chip" href={c.sources[0].url} target="_blank" rel="noreferrer">{c.sources[0].label}</a>
          : <span className="chip">{c.sources[0].label}</span>)}
        <span className="discl">Ikke finansiell rådgivning</span>
      </div>
    </div>
  );
}

function VerdtÅVite({ orgId }: { orgId: string }) {
  const ins = useLoad(() => api<{ cards: InsightCard[] }>('GET', `/api/organizations/${orgId}/market/insights`), [orgId]);
  const cards = ins.data?.cards ?? [];
  if (!cards.length) return null;
  return (
    <div className="panel">
      <div className="panel-head"><h2 style={{ marginTop: 0 }}>Verdt å vite</h2></div>
      <p className="subtitle" style={{ marginTop: 0 }}>Markedet, tolket mot dine egne tall.</p>
      <div className="cards">{cards.slice(0, 3).map((c) => <MarketInsightCard key={c.id} c={c} />)}</div>
    </div>
  );
}
```

- [ ] **Step 3: Render panelet** i `OverviewScreen` rett etter `<KomIGang ... />` (linje ~244): `<VerdtÅVite orgId={orgId} />`. I Framover-visningen (finn planlegger-skjermen), render øverste kort (`cards[0]`) som en kontekst-rad over prognosen.

- [ ] **Step 4: Bygg web** for å fange typefeil.

Run: `cd web && npx tsc --noEmit && npx vite build`
Expected: build OK.

- [ ] **Step 5: Manuell røyktest** (valgfri, lokalt): API mot `reknaren_test` + `vite`, org med gjeld + seedet signal, bekreft at kortet vises i Oversikt.

- [ ] **Step 6: Commit**

```bash
git add web/src/styles.css web/src/screens.tsx
git commit -m "feat(market): innsikts-kort i Oversikt (Verdt å vite) + Framover-kontekst"
```

---

### Task 10: Deploy-forberedelse (manuell migrasjon + cron)

**Files:** ingen kode — driftssteg.

- [ ] **Step 1:** Kjør `0022_market_insight.sql` MANUELT mot prod-Neon (samme prosedyre som tidligere migrasjoner) FØR merge/deploy.
- [ ] **Step 2:** Legg til en Render cron_job (eller utvid eksisterende scheduler) som kaller `POST https://ledgerly-coss.onrender.com/api/cron/market-refresh` med header `x-cron-secret: $REKNAREN_CRON_SECRET`, daglig (f.eks. 06:00). Norges Bank/SSB oppdaterer sjelden — daglig er rikelig.
- [ ] **Step 3:** Etter deploy: kall cron-ruten én gang manuelt (curl med token), bekreft 200 + at `insight_cards` fylles for minst én prod-org med gjeld.

---

## Self-Review

**Spec-dekning:**
- Offentlig ryggrad (Norges Bank rente + valuta, SSB KPI) → Tasks 3, 4 (+ FX-kilde finnes; persisteres via refresh om ønsket i v2). ✔
- NACE via Brreg → Task 5. ✔
- Tre regler → Task 6 dekker rate_debt + kpi_cost; FX-regel bevisst utsatt til v2 (krever fremtidige innkjøpsdata for kroner-effekt) — notert, ikke placeholder. ⚠ (bevisst v1-avgrensning)
- Framover + Oversikt «Verdt å vite» → Task 9. ✔
- Deterministisk, null KI → hele v1. ✔
- Disclosure + kildeattribusjon på hvert kort → Task 6 (sources) + Task 9 («Ikke finansiell rådgivning»). ✔
- Append-vennlig, manuell migrasjon → Tasks 1, 10. ✔

**Placeholder-skann:** Kjente åpne punkter er markert med konkrete verifiseringssteg (SDMX-seriekode i Task 3 steg 5; SSB ContentsCode i Task 4 steg 5; `journal_lines`-valutakolonne + `organizations.org_number`-kolonnenavn i Task 5). Disse er live-verifiseringer mot ekte API/skjema, ikke uferdig kode.

**Type-konsistens:** `MarketSignal`, `OrgExposure`, `GeneratedCard`, `MarketSources` brukt konsistent på tvers av Tasks 2–9. `impactMinor: bigint | null` ↔ DB `impact_minor BIGINT` ↔ JSON string ↔ frontend `kr()`-parsing er sammenhengende.

## Execution Handoff

Plan lagret i `docs/market-insight-plan-v1.md`.
